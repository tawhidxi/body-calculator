(function () {
  'use strict';

  /* ==========================================================================
     1. PURE CALCULATION FUNCTIONS
     Each function takes plain values and returns a plain value.
     No DOM access, no state, no side effects.
     ========================================================================== */

  // BMR: Mifflin-St Jeor basal metabolic rate from weight, height, age and sex.
  function calcBmr(weightKg, heightCm, age, sex) {
    var base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'female' ? base - 161 : base + 5;
  }

  // Activity multiplier: derived from average daily steps across five fixed bands.
  function calcActivityMultiplier(steps) {
    if (steps < 5000) return 1.2;
    if (steps < 7500) return 1.375;
    if (steps < 10000) return 1.5;
    if (steps < 12500) return 1.65;
    return 1.8;
  }

  // TDEE: total daily energy expenditure is BMR scaled by the activity multiplier.
  function calcTdee(bmr, multiplier) {
    return bmr * multiplier;
  }

  // Calories: -20% for fat loss, unchanged for maintain, +10% for lean gain.
  function calcCalories(tdee, goal) {
    if (goal === 'fat-loss') return tdee * 0.8;
    if (goal === 'lean-gain') return tdee * 1.1;
    return tdee;
  }

  // Protein: 1.8 g/kg for fat loss and lean gain, 1.4 g/kg for maintain.
  function calcProtein(weightKg, goal) {
    return goal === 'maintain' ? weightKg * 1.4 : weightKg * 1.8;
  }

  // Fat: 25% of target calories divided by 9 kcal per gram.
  function calcFat(calories) {
    return (calories * 0.25) / 9;
  }

  // Carbs: calories left after protein and fat are filled, divided by 4 kcal per gram.
  function calcCarbs(calories, proteinG, fatG) {
    return (calories - proteinG * 4 - fatG * 9) / 4;
  }

  // Water: 35 ml per kg of bodyweight plus 350 ml per full 5000 steps above 5000.
  function calcWaterMl(weightKg, steps) {
    var base = 35 * weightKg;
    var extraSteps = Math.max(0, steps - 5000);
    var blocks = Math.floor(extraSteps / 5000);
    return base + blocks * 350;
  }

  // Step target: current average plus 15%, hard-capped at 15000 steps.
  function calcStepTarget(steps) {
    return Math.min(15000, Math.round(steps * 1.15));
  }

  // Weekly weight change in kg from the daily calorie delta, at 7700 kcal per kg.
  function calcWeeklyChangeKg(calories, tdee) {
    return ((calories - tdee) * 7) / 7700;
  }

  // Summary text: weekly change in kg plus a rough timeline to the first kilo.
  function buildSummary(weeklyChangeKg, goal) {
    var magnitude = Math.abs(weeklyChangeKg);

    if (goal === 'maintain' || magnitude < 0.05) {
      return 'Estimated weekly change: about 0 kg — hold steady and re-check in 2 to 4 weeks.';
    }

    var weeksPerKg = 1 / magnitude;
    var timeline = weeksPerKg < 1.5
      ? 'about 1 week'
      : 'about ' + Math.round(weeksPerKg * 10) / 10 + ' weeks';
    var perWeek = Math.round(magnitude * 100) / 100;
    var direction = weeklyChangeKg < 0 ? 'loss' : 'gain';

    return 'Estimated weekly change: about ' + perWeek + ' kg of ' + direction +
      '. At this pace 1 kg takes ' + timeline + '.';
  }

  /* ==========================================================================
     2. DOM WIRING
     Everything below touches the document. Nothing is exposed globally.
     ========================================================================== */

  function init() {
    var form = document.getElementById('calc-form');
    var results = document.getElementById('results');
    var summary = document.getElementById('summary');
    var recalculateBtn = document.getElementById('recalculate');
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var fields = [
      document.getElementById('weight'),
      document.getElementById('age'),
      document.getElementById('sex'),
      document.getElementById('height'),
      document.getElementById('steps'),
      document.getElementById('goal')
    ];

    var errorFor = function (field) {
      return document.getElementById(field.id + '-error');
    };

    var showError = function (field, message) {
      errorFor(field).textContent = message;
      field.setAttribute('aria-invalid', 'true');
    };

    var clearError = function (field) {
      errorFor(field).textContent = '';
      field.removeAttribute('aria-invalid');
    };

    // Native validationMessage is browser-localised; these give stable, readable text.
    var describeInvalid = function (field) {
      if (field.validity.valueMissing) return 'This field is required.';
      if (field.validity.rangeUnderflow) return 'Enter ' + field.min + ' or more.';
      if (field.validity.rangeOverflow) return 'Enter ' + field.max + ' or less.';
      if (field.validity.stepMismatch) return 'Enter a value in steps of ' + field.getAttribute('step') + '.';
      return 'Enter a valid value.';
    };

    var validateField = function (field) {
      if (field.checkValidity()) {
        clearError(field);
        return true;
      }
      showError(field, describeInvalid(field));
      return false;
    };

    var validateAll = function () {
      var firstInvalid = null;
      fields.forEach(function (field) {
        if (!validateField(field) && !firstInvalid) {
          firstInvalid = field;
        }
      });
      return firstInvalid;
    };

    var hideResults = function () {
      results.classList.remove('is-visible');
      results.hidden = true;
    };

    var revealResults = function () {
      results.hidden = false;
      // Force a reflow so the opacity/transform transition actually runs.
      void results.offsetWidth;
      results.classList.add('is-visible');
    };

    var scrollTo = function (element) {
      element.scrollIntoView({
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
        block: 'start'
      });
    };

    // Clear an error as soon as the field becomes valid again.
    fields.forEach(function (field) {
      field.addEventListener('input', function () {
        if (field.checkValidity()) clearError(field);
      });
      field.addEventListener('change', function () {
        if (field.checkValidity()) clearError(field);
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var firstInvalid = validateAll();

      if (firstInvalid) {
        hideResults();
        firstInvalid.focus();
        return;
      }

      var weight = parseFloat(document.getElementById('weight').value);
      var age = parseInt(document.getElementById('age').value, 10);
      var sex = document.getElementById('sex').value;
      var height = parseFloat(document.getElementById('height').value);
      var steps = parseInt(document.getElementById('steps').value, 10);
      var goal = document.getElementById('goal').value;

      var multiplier = calcActivityMultiplier(steps);
      var bmr = calcBmr(weight, height, age, sex);
      var tdee = calcTdee(bmr, multiplier);
      var calories = calcCalories(tdee, goal);
      var protein = calcProtein(weight, goal);
      var fat = calcFat(calories);
      var carbs = calcCarbs(calories, protein, fat);
      var waterMl = calcWaterMl(weight, steps);
      var stepTarget = calcStepTarget(steps);
      var weeklyChangeKg = calcWeeklyChangeKg(calories, tdee);

      document.getElementById('res-calories').textContent = Math.round(calories).toLocaleString('en-US');
      document.getElementById('res-protein').textContent = Math.round(protein).toLocaleString('en-US');
      document.getElementById('res-carbs').textContent = Math.max(0, Math.round(carbs)).toLocaleString('en-US');
      document.getElementById('res-fat').textContent = Math.round(fat).toLocaleString('en-US');
      document.getElementById('res-water').textContent = (Math.round(waterMl) / 1000).toFixed(2);
      document.getElementById('res-steps').textContent = stepTarget.toLocaleString('en-US');
      summary.textContent = buildSummary(weeklyChangeKg, goal);

      revealResults();
      scrollTo(results);
    });

    recalculateBtn.addEventListener('click', function () {
      scrollTo(form);
      if (!prefersReducedMotion.matches) {
        document.getElementById('weight').focus({ preventScroll: true });
      }
    });
  }

  init();
})();
