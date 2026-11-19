(function () {
  const SORTED = "EILOUV";
  const PHRASE = "I LOVE U";
  const MISS = "Those letters don't unscramble to anything yet.";

  const form = document.getElementById("unscramble-form");
  const inputs = Array.from(document.querySelectorAll(".letter"));
  const result = document.getElementById("result");

  function onlyLetter(value) {
    const match = String(value).toUpperCase().match(/[A-Z]/g);
    return match ? match[match.length - 1] : "";
  }

  function currentLetters() {
    return inputs.map(function (input) {
      return onlyLetter(input.value);
    }).join("");
  }

  function showResult(text, isPhrase) {
    result.classList.remove("fade-in", "is-phrase");
    result.textContent = "";
    void result.offsetWidth;
    result.textContent = text;
    if (isPhrase) result.classList.add("is-phrase");
    result.classList.add("fade-in");
  }

  function unscramble() {
    const letters = currentLetters();
    const sorted = letters.split("").sort().join("");
    if (letters.length === 6 && sorted === SORTED) {
      showResult(PHRASE, true);
    } else {
      showResult(MISS, false);
    }
  }

  inputs.forEach(function (input, index) {
    input.addEventListener("input", function () {
      const letter = onlyLetter(input.value);
      input.value = letter;
      if (letter && index < inputs.length - 1) {
        inputs[index + 1].focus();
        inputs[index + 1].select();
      }
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Backspace") {
        if (input.value === "" && index > 0) {
          event.preventDefault();
          inputs[index - 1].value = "";
          inputs[index - 1].focus();
        }
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        inputs[index - 1].focus();
        inputs[index - 1].select();
      }
      if (event.key === "ArrowRight" && index < inputs.length - 1) {
        event.preventDefault();
        inputs[index + 1].focus();
        inputs[index + 1].select();
      }
    });

    input.addEventListener("paste", function (event) {
      event.preventDefault();
      const pasted = (event.clipboardData || window.clipboardData)
        .getData("text")
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
      if (!pasted) return;
      for (let offset = 0; offset < pasted.length && index + offset < inputs.length; offset += 1) {
        inputs[index + offset].value = pasted[offset];
      }
      const next = Math.min(index + pasted.length, inputs.length - 1);
      inputs[next].focus();
      inputs[next].select();
    });

    input.addEventListener("focus", function () {
      input.select();
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    unscramble();
  });
})();
