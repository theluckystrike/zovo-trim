// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

(function runTrimForgeWelcome() {
    "use strict";
    const steps = [...document.querySelectorAll(".tfg-welcome-step")];
    const dots = [...document.querySelectorAll(".tfg-progress span")];
    const back = document.getElementById("tfg-back");
    const next = document.getElementById("tfg-next");
    const count = document.getElementById("tfg-step-count");
    const progress = document.querySelector(".tfg-progress");
    let index = 0;

    function render() {
        steps.forEach((step, stepIndex) => {
            const active = stepIndex === index;
            step.hidden = !active;
            step.classList.toggle("is-active", active);
            dots[stepIndex].classList.toggle("is-active", active);
        });
        back.disabled = index === 0;
        next.textContent = index === 0 ? "Show me how" : index === 1 ? "Privacy & finish" : "Open my library";
        count.textContent = `${index + 1} of ${steps.length}`;
        progress.setAttribute("aria-valuenow", String(index + 1));
    }

    back.addEventListener("click", () => { index = Math.max(0, index - 1); render(); });
    next.addEventListener("click", () => {
        if (index < steps.length - 1) {
            index += 1;
            render();
        } else {
            chrome.runtime.openOptionsPage();
        }
    });
    render();
})();
