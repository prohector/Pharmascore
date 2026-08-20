(function () {
  const state = {
    QUESTION_AREAS: [],
    ANALYSIS_MODE: '',
    QUESTIONS_LOADED: false,
    ANALYSIS_GATE_CHOSEN: false,
    QUESTIONS_LOAD_FAILED: false,
    QUESTIONS_LOAD_ERROR: '',
    SOLVENT_OPTIONS: [],
    COLUMN_OPTIONS: [],
    BUFFER_OPTIONS: [],
    AUXILIARY_EQUIPMENT_OPTIONS: [],
    INSTRUMENT_OPTIONS: [],
    SAMPLE_ANALYSIS_RESULTS_OPTIONS: [],
    SOURCES_LOADED: false,
    currentTab: 0,
    fixedCostsSubTab: 0,
    analyticalPerformanceSubTab: 0,
    analyticalConsumablesSubTab: 0,
    ANSWERS: {},
    RECURRING_MIXES: {},
    SOLVENT_LISTS: {},
    FIXED_COST_SUBTABS: [
      { title: 'Section 1: Primary Instrumentation', questionIds: ['equip_basic'] },
      { title: 'Section 2: Column Characteristics', questionIds: ['equip_section2'] },
      { title: 'Section 3: Auxiliary Equipment', questionIds: ['equip_section3', 'aux_pretreat_basic', 'aux_pretreat_advanced', 'aux_pretreat_omics', 'aux_pretreat_software'] }
    ],
    ANALYTICAL_PERFORMANCE_SUBTABS: [
      { title: 'System Suitability', questionIds: ['perf8', 'perf9', 'perf10', 'perf2'] },
      { title: 'Method validation', questionIds: ['perf0', 'perf7', 'perf1', 'perf3', 'perf5', 'perf12'] },
      { title: 'Matrix performance', questionIds: ['sample_analysis_results_heading', 'sample_analysis_results', 'perf13', 'perf14', 'perf15', 'perf17'] }
    ],
    ANALYTICAL_CONSUMABLES_SUBTABS: [
      { title: 'Section 1: Mobile phase', questionIds: ['econ_rec1'] },
      { title: 'Section 2: Sample pretreatment', questionIds: ['sample_pretreat_solvent', 'sample_pretreat_reagent', 'sample_pretreat_materials'] }
    ],
    SECTION_GUIDANCE: {
      'Analytical Performance': {
        summary: 'Values are derived from the validation of the corresponding standard(s). For multianalyte methods, each parameter may be reported as the mean value across all analytes.',
        steps: [
          'Enter number of analytes ________',
          'Use the same units shown in each question label.',
          'If you are unsure, check your validation report before entering numbers.',
          'Complete all required items before moving to the next section.'
        ]
      },
      'Practicality': {
        summary: 'Describe how practical your method is in daily work conditions.',
        steps: [
          'Enter realistic times and sample counts from normal operation.',
          'Use typical values, not best-case or one-off values.',
          'Keep values consistent with your actual workflow.'
        ]
      },
      'Equipment Fixed Costs': {
        summary: 'This section captures one-time or infrastructure-related economic choices across three sub-tabs.',
        steps: [
          'Use the three sub-tabs to move through primary instrumentation, column characteristics, and auxiliary equipment costs.',
          'Select one basic instrument from the dropdown in section 1.',
          'Complete the column selector in section 2 and the auxiliary checklists in section 3.'
        ]
      },
      'Analytical Consumables': {
        summary: 'Build the mobile phase composition and per-run analytical consumables step by step.',
        steps: [
          'Add each solvent with its percentage and click Add.',
          'Add modifiers and buffers with the requested concentration.',
          'Review the lists and remove entries if needed before submitting.'
        ]
      },
      'Green assessment': {
        summary: 'Provide information related to environmental impact and hazard profile.',
        steps: [
          'Choose the closest option for material usage practices.',
          'Enter hazard values based on your documented solvent and reagent usage.',
          'Double-check values before final submission.'
        ]
      }
    }
  };

  Object.defineProperties(window, {
    PharmascoreState: { value: state, writable: false, configurable: true },
    QUESTION_AREAS: {
      get() { return state.QUESTION_AREAS; },
      set(v) { state.QUESTION_AREAS = v; },
      configurable: true
    },
    ANALYSIS_MODE: {
      get() { return state.ANALYSIS_MODE; },
      set(v) { state.ANALYSIS_MODE = v; },
      configurable: true
    },
    QUESTIONS_LOADED: {
      get() { return state.QUESTIONS_LOADED; },
      set(v) { state.QUESTIONS_LOADED = v; },
      configurable: true
    },
    ANALYSIS_GATE_CHOSEN: {
      get() { return state.ANALYSIS_GATE_CHOSEN; },
      set(v) { state.ANALYSIS_GATE_CHOSEN = v; },
      configurable: true
    },
    QUESTIONS_LOAD_FAILED: {
      get() { return state.QUESTIONS_LOAD_FAILED; },
      set(v) { state.QUESTIONS_LOAD_FAILED = v; },
      configurable: true
    },
    QUESTIONS_LOAD_ERROR: {
      get() { return state.QUESTIONS_LOAD_ERROR; },
      set(v) { state.QUESTIONS_LOAD_ERROR = v; },
      configurable: true
    },
    SOLVENT_OPTIONS: {
      get() { return state.SOLVENT_OPTIONS; },
      set(v) { state.SOLVENT_OPTIONS = v; },
      configurable: true
    },
    COLUMN_OPTIONS: {
      get() { return state.COLUMN_OPTIONS; },
      set(v) { state.COLUMN_OPTIONS = v; },
      configurable: true
    },
    BUFFER_OPTIONS: {
      get() { return state.BUFFER_OPTIONS; },
      set(v) { state.BUFFER_OPTIONS = v; },
      configurable: true
    },
    AUXILIARY_EQUIPMENT_OPTIONS: {
      get() { return state.AUXILIARY_EQUIPMENT_OPTIONS; },
      set(v) { state.AUXILIARY_EQUIPMENT_OPTIONS = v; },
      configurable: true
    },
    INSTRUMENT_OPTIONS: {
      get() { return state.INSTRUMENT_OPTIONS; },
      set(v) { state.INSTRUMENT_OPTIONS = v; },
      configurable: true
    },
    SAMPLE_ANALYSIS_RESULTS_OPTIONS: {
      get() { return state.SAMPLE_ANALYSIS_RESULTS_OPTIONS; },
      set(v) { state.SAMPLE_ANALYSIS_RESULTS_OPTIONS = v; },
      configurable: true
    },
    SOURCES_LOADED: {
      get() { return state.SOURCES_LOADED; },
      set(v) { state.SOURCES_LOADED = v; },
      configurable: true
    },
    currentTab: {
      get() { return state.currentTab; },
      set(v) { state.currentTab = v; },
      configurable: true
    },
    fixedCostsSubTab: {
      get() { return state.fixedCostsSubTab; },
      set(v) { state.fixedCostsSubTab = v; },
      configurable: true
    },
    analyticalPerformanceSubTab: {
      get() { return state.analyticalPerformanceSubTab; },
      set(v) { state.analyticalPerformanceSubTab = v; },
      configurable: true
    },
    analyticalConsumablesSubTab: {
      get() { return state.analyticalConsumablesSubTab; },
      set(v) { state.analyticalConsumablesSubTab = v; },
      configurable: true
    },
    ANSWERS: {
      get() { return state.ANSWERS; },
      set(v) { state.ANSWERS = v; },
      configurable: true
    },
    RECURRING_MIXES: {
      get() { return state.RECURRING_MIXES; },
      set(v) { state.RECURRING_MIXES = v; },
      configurable: true
    },
    SOLVENT_LISTS: {
      get() { return state.SOLVENT_LISTS; },
      set(v) { state.SOLVENT_LISTS = v; },
      configurable: true
    },
    FIXED_COST_SUBTABS: {
      get() { return state.FIXED_COST_SUBTABS; },
      set(v) { state.FIXED_COST_SUBTABS = v; },
      configurable: true
    },
    ANALYTICAL_PERFORMANCE_SUBTABS: {
      get() { return state.ANALYTICAL_PERFORMANCE_SUBTABS; },
      set(v) { state.ANALYTICAL_PERFORMANCE_SUBTABS = v; },
      configurable: true
    },
    ANALYTICAL_CONSUMABLES_SUBTABS: {
      get() { return state.ANALYTICAL_CONSUMABLES_SUBTABS; },
      set(v) { state.ANALYTICAL_CONSUMABLES_SUBTABS = v; },
      configurable: true
    },
    SECTION_GUIDANCE: {
      get() { return state.SECTION_GUIDANCE; },
      set(v) { state.SECTION_GUIDANCE = v; },
      configurable: true
    }
  });

  window.PharmascoreState = state;
}());
