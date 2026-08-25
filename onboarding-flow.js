/* The onboarding flow's nine steps and the rules that gate them — the page
   renders, this decides. See CLAUDE.md "Customer onboarding". */
(function (root) {
  "use strict";

  var STEPS = [
    { n: 1, group: "Account", label: "Personal information", title: "Personal information",
      intro: "Start with the person who will manage the account. You can invite colleagues once the account is active." },
    { n: 2, group: "Company", label: "Company", title: "Company or organization information",
      intro: "PeakPower contracts with the legal entity, so this must match the KvK register." },
    { n: 3, group: "Company", label: "Registered address", title: "Registered address",
      intro: "Pulled from the KvK register where we can find it — check it and correct anything that is wrong." },
    { n: 4, group: "Company", label: "Industry", title: "Industry",
      intro: "Optional. It only helps the desk pick a sensible starting load profile." },
    { n: 5, group: "Profile", label: "Electricity volume", title: "Your electricity volume",
      intro: "Two answers: which direction your meter runs, and roughly how much passes through it in a year." },
    { n: 6, group: "Verification", label: "Bank verification", title: "Bank account verification",
      intro: "One cent, once. It proves the account belongs to the company that signs the agreement." },
    { n: 7, group: "Agreement", label: "Signing authority", title: "Signing authority",
      intro: "Who may bind the company decides where the agreement goes next." },
    { n: 8, group: "Agreement", label: "Authorised signatories", title: "Who needs to sign the agreement?",
      intro: "Add every person required to sign on behalf of the company. Each receives a personal signing link." },
    { n: 9, group: "Agreement", label: "Pending approval", title: "Pending approval",
      intro: "Your application is with the PeakPower desk. Nothing further is needed from you right now." }
  ];

  var LAST_STEP = STEPS.length;

  var ENTITY_TYPES = ["BV", "NV", "Eenmanszaak", "VOF", "Maatschap", "CV", "Stichting", "Vereniging", "Coöperatie"];

  /* "Not specified" leads and is the default: step 4 is optional, so index 0
     has to mean "not answered" rather than silently answering Agriculture. */
  var INDUSTRIES = ["Not specified",
    "Agriculture & Food Processing", "Arts, Medias & Entertainment", "Casinos & Gambling",
    "Construction", "Cryptocurrency", "Defense & Military Industry", "Education",
    "Energy & Utilities", "Financial Services", "Food & Lodging", "Government",
    "Health Professions", "Holding Company", "Industry & Manufacturing", "Mining",
    "Non-Profit", "Professional Services", "Real Estate", "Retail Trade, Automotive",
    "Retail Trade, Jewelry & Antiques", "Retail Trade, Others", "Sport & Tourism",
    "Technology & Computing", "Transportation"];

  var FLOWS = ["Consumption", "Production", "Both"];

  var VOLUMES = ["Less than 250 MWh", "250 – 500 MWh", "500 – 1.000 MWh", "1.000 – 2.500 MWh", "More than 2.500 MWh"];
  var VOLUMES_SHORT = ["< 250 MWh", "250–500 MWh", "500–1.000 MWh", "1.000–2.500 MWh", "> 2.500 MWh"];

  var AUTHORITY = [
    { label: "Yes, I am authorised to sign", note: "You sign alone; the agreement is issued to you." },
    { label: "Yes, together with another authorised person", note: "You and at least one colleague both sign." },
    { label: "No, someone else needs to sign", note: "We email the people you name; you keep managing the account." }
  ];

  var MIN_PASSWORD = 12;
  var KVK_DIGITS = 8;

  function blankSignatory() { return { first: "", last: "", email: "", locked: false }; }

  function defaultState() {
    return {
      step: 1,
      agreed: false,
      bankVerified: false,
      instructionsReady: false,
      entityIndex: 0,
      industryIndex: 0,
      flowIndex: 0,
      // -1, not 0: index 0 is a real answer in both lists.
      volumeIndex: -1,
      authorityIndex: -1,
      f: { firstName: "", lastName: "", email: "", password: "", orgName: "", kvk: "", street: "", city: "", postcode: "" },
      signatories: [blankSignatory()]
    };
  }

  /**
   * A complete application, for walking the flow without typing nine screens.
   *
   * Every field the flow carries, not only the ones a step refuses on — the
   * entity type and the bank verification are answers too, and leaving them at
   * their defaults made "prefilled" quietly untrue. The test that pins this is
   * that every one of the nine steps validates.
   */
  function prefilledState() {
    var s = defaultState();
    s.f = {
      firstName: "Peter", lastName: "de Vries", email: "p.devries@vandersteen.nl",
      password: "correct-horse-battery", orgName: "Vandersteen Koeling B.V.", kvk: "24398112",
      street: "Havenweg 22", city: "Rotterdam", postcode: "3089 JJ"
    };
    s.agreed = true;
    s.bankVerified = true;
    s.entityIndex = ENTITY_TYPES.indexOf("BV");
    // A refrigerated warehouse for food. indexOf, not a literal index, so a
    // reordered list cannot silently prefill a different industry.
    s.industryIndex = INDUSTRIES.indexOf("Agriculture & Food Processing");
    s.flowIndex = FLOWS.indexOf("Both");
    s.volumeIndex = 3;
    s.authorityIndex = 1;
    s.signatories = signatoriesForAuthority(1, s.f);
    s.signatories[1] = { first: "Marieke", last: "Vandersteen", email: "m.vandersteen@vandersteen.nl", locked: false };
    return s;
  }

  /** Digits only — a KvK number pasted with spaces or dots is still eight digits. */
  function kvkDigits(value) { return String(value || "").replace(/\D/g, ""); }

  /** Index > 0, not >= 0: "@company.nl" has no local part. */
  function looksLikeEmail(value) { return String(value || "").indexOf("@") > 0; }

  function signatoryComplete(s) {
    return !!(s && String(s.first).trim() && String(s.last).trim() && looksLikeEmail(s.email));
  }

  /** Steps 3, 4, 6 and 9 are always valid on purpose — see CLAUDE.md. */
  function stepValid(state) {
    var f = state.f;
    switch (state.step) {
      case 1:
        return !!(String(f.firstName).trim() && String(f.lastName).trim() &&
          looksLikeEmail(f.email) && String(f.password).length >= MIN_PASSWORD && state.agreed);
      case 2:
        return !!(String(f.orgName).trim() && kvkDigits(f.kvk).length === KVK_DIGITS);
      case 5:
        return state.volumeIndex >= 0;
      case 7:
        return state.authorityIndex >= 0;
      case 8:
        return state.signatories.length >= minSignatories(state.authorityIndex) &&
          state.signatories.every(signatoryComplete);
      default:
        return true;
    }
  }

  /** Every reason stepValid can refuse has a line here naming what is missing. */
  function hint(state) {
    var f = state.f;
    switch (state.step) {
      case 1:
        if (!String(f.firstName).trim() || !String(f.lastName).trim()) { return "Enter your first and last name to continue."; }
        if (!looksLikeEmail(f.email)) { return "Enter the email address you will sign in with."; }
        if (String(f.password).length < MIN_PASSWORD) { return "Choose a password of at least " + MIN_PASSWORD + " characters."; }
        if (!state.agreed) { return "Accept the Terms of Use to create the account."; }
        return "Your name and email carry through to the agreement.";
      case 2:
        if (!String(f.orgName).trim()) { return "Enter the organization name as registered."; }
        if (kvkDigits(f.kvk).length !== KVK_DIGITS) { return "The KvK number is eight digits."; }
        return "We look the company up in the KvK register on the next step.";
      case 3:
        return "Blank is acceptable — the desk resolves the address during review.";
      case 4:
        return "Optional. Continue without choosing if you prefer.";
      case 5:
        return state.volumeIndex < 0
          ? "Pick the band that matches your yearly volume."
          : "A band is enough — exact metering follows from your connections.";
      case 6:
        return state.bankVerified
          ? "Verified. The agreement can be issued to your signatories."
          : "Verification can also complete after you submit.";
      case 7:
        return state.authorityIndex < 0
          ? "Choose one option to continue."
          : "You can change this before the agreement is signed.";
      case 8:
        if (state.signatories.length < minSignatories(state.authorityIndex)) {
          return "You answered that two people sign — add the second signatory.";
        }
        return stepValid(state)
          ? "Each signatory receives a personal link; we verify their email before signing."
          : "Every signatory needs a first name, last name and email address.";
      default:
        return "The desk reviews within one business day. You will be emailed as soon as the account is active.";
    }
  }

  /** "Someone else signs" drops the applicant: they manage, they do not sign. */
  function signatoriesForAuthority(authorityIndex, f) {
    var me = { first: f.firstName, last: f.lastName, email: f.email, locked: true };
    if (authorityIndex === 0) { return [me]; }
    if (authorityIndex === 1) { return [me, blankSignatory()]; }
    return [blankSignatory()];
  }

  /** "Together with another authorised person" means two. */
  function minSignatories(authorityIndex) { return authorityIndex === 1 ? 2 : 1; }

  /** "PP-ONB-7F3K" — one reference per application, quoted on the bank transfer. */
  function applicationRef() { return "PP-ONB-7F3K"; }

  function fullName(f) { return (String(f.firstName).trim() + " " + String(f.lastName).trim()).trim(); }

  /** Every answer, including the blank ones — an omission reads as complete. */
  function summaryRows(state) {
    var f = state.f;
    return [
      { k: "Account", v: fullName(f) || "—" },
      { k: "Email", v: f.email || "—" },
      { k: "Organization", v: f.orgName || "—" },
      { k: "Legal form", v: ENTITY_TYPES[state.entityIndex] },
      { k: "KvK number", v: f.kvk || "—" },
      { k: "Registered address", v: [f.street, f.city].filter(Boolean).join(", ") || "Not registered" },
      { k: "Postcode", v: f.postcode || "—" },
      { k: "Industry", v: INDUSTRIES[state.industryIndex] },
      { k: "Direction", v: FLOWS[state.flowIndex] },
      { k: "Annual volume", v: state.volumeIndex >= 0 ? VOLUMES[state.volumeIndex] : "Not given" },
      { k: "Signing authority", v: state.authorityIndex >= 0 ? AUTHORITY[state.authorityIndex].label : "—" },
      { k: "Bank account", v: state.bankVerified ? "Verified with € 0,01" : "Not verified yet" }
    ];
  }

  /** Clamped to the flow's own length, so a bad deep link lands on a real step. */
  function clampStep(n) { return Math.max(1, Math.min(LAST_STEP, Math.round(Number(n) || 1))); }

  var api = {
    STEPS: STEPS,
    LAST_STEP: LAST_STEP,
    ENTITY_TYPES: ENTITY_TYPES,
    INDUSTRIES: INDUSTRIES,
    FLOWS: FLOWS,
    VOLUMES: VOLUMES,
    VOLUMES_SHORT: VOLUMES_SHORT,
    AUTHORITY: AUTHORITY,
    MIN_PASSWORD: MIN_PASSWORD,
    KVK_DIGITS: KVK_DIGITS,
    blankSignatory: blankSignatory,
    defaultState: defaultState,
    prefilledState: prefilledState,
    kvkDigits: kvkDigits,
    looksLikeEmail: looksLikeEmail,
    signatoryComplete: signatoryComplete,
    minSignatories: minSignatories,
    stepValid: stepValid,
    hint: hint,
    signatoriesForAuthority: signatoriesForAuthority,
    applicationRef: applicationRef,
    fullName: fullName,
    summaryRows: summaryRows,
    clampStep: clampStep
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.OnboardingFlow = api;
  }
})(typeof window !== "undefined" ? window : this);
