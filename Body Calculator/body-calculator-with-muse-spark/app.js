(function () {
  'use strict';

  // --- Pure calculation functions ---

  // BMR via Mifflin-St Jeor from weight, height, age and sex.
  function calculateBMR(weightKg, heightCm, age, sex) {
    if (sex === 'female') {
      return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }

  // Activity multiplier derived from average daily step count.
  function getActivityMultiplier(steps) {
    if (steps < 5000) return 1.2;
    if (steps < 7500) return 1.375;
    if (steps < 10000) return 1.5;
    if (steps < 12500) return 1.65;
    return 1.8;
  }

  // Total daily energy expenditure from BMR and activity multiplier.
  function calculateTDEE(bmr, multiplier) {
    return bmr * multiplier;
  }

  // Daily calorie target adjusted for the selected goal.
  function calculateTargetCalories(tdee, goal) {
    if (goal === 'fat-loss') return tdee * 0.8;
    if (goal === 'lean-gain') return tdee * 1.1;
    return tdee;
  }

  // Daily protein target in grams from body weight and goal.
  function calculateProtein(weightKg, goal) {
    if (goal === 'maintain') return 1.4 * weightKg;
    return 1.8 * weightKg;
  }

  // Daily fat target in grams as 25% of target calories.
  function calculateFat(targetCalories) {
    return (targetCalories * 0.25) / 9;
  }

  // Daily carb target in grams from calories left after protein and fat.
  function calculateCarbs(targetCalories, proteinG, fatG) {
    return (targetCalories - proteinG * 4 - fatG * 9) / 4;
  }

  // Daily water target in ml: 35ml/kg plus 350ml per full 5000 steps over 5000.
  function calculateWater(weightKg, steps) {
    var base = 35 * weightKg;
    var extraBlocks = Math.floor(Math.max(0, steps - 5000) / 5000);
    return base + extraBlocks * 350;
  }

  // Suggested step target: +15% over current average, capped at 15000.
  function calculateStepTarget(steps) {
    return Math.min(15000, Math.round(steps * 1.15));
  }

  // Estimated weekly weight change in kg from daily calorie delta (7700 kcal/kg).
  function calculateWeeklyChange(targetCalories, tdee) {
    return ((targetCalories - tdee) * 7) / 7700;
  }

  // Human-readable summary line with weekly change and rough 1kg timeline.
  function buildSummaryLine(weeklyChangeKg, goal) {
    var abs = Math.abs(weeklyChangeKg);
    if (goal === 'maintain' || abs < 0.05) {
      return 'Estimated change: about 0 kg per week. Weight should stay roughly stable at maintenance.';
    }
    var direction = weeklyChangeKg < 0 ? 'loss' : 'gain';
    var weeksPerKg = 1 / abs;
    var weeksText = weeksPerKg < 1.5 ? 'about 1 week' : 'about ' + (Math.round(weeksPerKg * 10) / 10) + ' weeks';
    var rounded = (Math.round(abs * 100) / 100).toFixed(2);
    return 'Estimated ' + direction + ': ' + rounded + ' kg per week. At this pace, roughly 1 kg takes ' + weeksText + '.';
  }

  // --- DOM wiring ---

  function init() {
    var form = document.getElementById('calc-form');
    var results = document.getElementById('results');
    var recalcBtn = document.getElementById('recalculate-btn');
    var summaryLine = document.getElementById('summary-line');

    var fields = ['weight', 'age', 'sex', 'height', 'steps', 'goal'].map(function (id) {
      return document.getElementById(id);
    });

    function showError(field) {
      var err = document.getElementById(field.id + '-error');
      if (err) err.textContent = field.validationMessage || 'Please enter a valid value.';
      field.setAttribute('aria-invalid', 'true');
    }

    function clearError(field) {
      var err = document.getElementById(field.id + '-error');
      if (err) err.textContent = '';
      field.removeAttribute('aria-invalid');
    }

    function hideResults() {
      results.classList.remove('is-visible');
      results.setAttribute('hidden', '');
    }

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

      var firstInvalid = null;
      fields.forEach(function (field) {
        if (!field.checkValidity()) {
          showError(field);
          if (!firstInvalid) firstInvalid = field;
        } else {
          clearError(field);
        }
      });

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

      var bmr = calculateBMR(weight, height, age, sex);
      var multiplier = getActivityMultiplier(steps);
      var tdee = calculateTDEE(bmr, multiplier);
      var calories = calculateTargetCalories(tdee, goal);
      var protein = calculateProtein(weight, goal);
      var fat = calculateFat(calories);
      var carbs = calculateCarbs(calories, protein, fat);
      var waterMl = calculateWater(weight, steps);
      var stepTarget = calculateStepTarget(steps);
      var weeklyChange = calculateWeeklyChange(calories, tdee);

      document.getElementById('res-calories').textContent = String(Math.round(calories));
      document.getElementById('res-protein').textContent = String(Math.round(protein));
      document.getElementById('res-carbs').textContent = String(Math.max(0, Math.round(carbs)));
      document.getElementById('res-fat').textContent = String(Math.round(fat));
      document.getElementById('res-water').textContent = (Math.round((waterMl / 1000) * 10) / 10).toFixed(1);
      document.getElementById('res-steps').textContent = stepTarget.toLocaleString('en-US');
      summaryLine.textContent = buildSummaryLine(weeklyChange, goal);

      results.removeAttribute('hidden');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          results.classList.add('is-visible');
        });
      });
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    recalcBtn.addEventListener('click', function () {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = document.getElementById('weight');
      if (first) first.focus({ preventScroll: true });
    });
  }

  init();
})();
