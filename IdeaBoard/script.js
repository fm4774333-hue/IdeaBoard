
const board = document.getElementById("board");
const boardArea = document.getElementById("boardArea");
const saveStatus = document.getElementById("saveStatus");

let zoom = 1;
let noteCount = 0;
let connecting = false;
let firstNote = null;
let connections = [];

const colors = [
    "#fff0a8",
    "#ffc9d9",
    "#c9e9ff",
    "#d4f5d0",
    "#e4d5ff",
    "#ffffff"
];

const svg = document.getElementById("connections");

// =====================================
// VERBINDUNGEN ZEICHNEN
// =====================================

function drawConnections() {
    svg.querySelectorAll(".connection-line").forEach(line => {
        line.remove();
    });

    connections.forEach(connection => {
        const from = [...document.querySelectorAll(".note")]
            .find(note => note.dataset.id === connection.from);

        const to = [...document.querySelectorAll(".note")]
            .find(note => note.dataset.id === connection.to);

        if (!from || !to) return;

        const x1 = parseFloat(from.style.left) + from.offsetWidth / 2;
        const y1 = parseFloat(from.style.top) + from.offsetHeight / 2;

        const x2 = parseFloat(to.style.left) + to.offsetWidth / 2;
        const y2 = parseFloat(to.style.top) + to.offsetHeight / 2;

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );

        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", "#7165dc");
        line.setAttribute("stroke-width", "3");
        line.setAttribute("marker-end", "url(#arrowHead)");
        line.setAttribute("class", "connection-line");

        svg.appendChild(line);
    });
}

// =====================================
// SPEICHERN
// =====================================

function saveBoard() {
    const notes = [...document.querySelectorAll(".note")].map(note => ({
        id: note.dataset.id,
        x: parseFloat(note.style.left),
        y: parseFloat(note.style.top),
        color: note.style.backgroundColor,
        text: note.querySelector("textarea").value
    }));

    localStorage.setItem(
        "ideaboard-notes",
        JSON.stringify(notes)
    );

    localStorage.setItem(
        "ideaboard-connections",
        JSON.stringify(connections)
    );

    localStorage.setItem(
        "ideaboard-title",
        document.getElementById("boardName").value
    );

    saveStatus.textContent = "● Gespeichert";

    drawConnections();
}

// =====================================
// NOTIZ ERSTELLEN
// =====================================

function createNote(x = 450, y = 200, color, text = "", id) {

    noteCount++;

    const note = document.createElement("div");

    note.className = "note";
    note.dataset.id = id || Date.now() + "-" + noteCount;

    note.style.left = x + "px";
    note.style.top = y + "px";

    note.style.backgroundColor =
        color || colors[Math.floor(Math.random() * colors.length)];

    note.innerHTML = `
        <div class="note-header">
            <span>NOTIZ</span>
            <button class="delete-note" title="Löschen">×</button>
        </div>

        <textarea placeholder="Schreibe deine Idee hier..."></textarea>

        <div class="note-colors">
            ${colors.map(c => `
                <button
                    class="color-choice"
                    style="background:${c}"
                    data-color="${c}"
                    title="Farbe ändern">
                </button>
            `).join("")}
        </div>
    `;

    const textarea = note.querySelector("textarea");

    textarea.value = text;

    textarea.addEventListener("input", saveBoard);

    // NOTIZ LÖSCHEN

    note.querySelector(".delete-note").addEventListener("click", () => {

        connections = connections.filter(connection =>
            connection.from !== note.dataset.id &&
            connection.to !== note.dataset.id
        );

        if (firstNote === note) {
            firstNote = null;
        }

        note.remove();
        saveBoard();
    });

    // FARBEN ÄNDERN

    note.querySelectorAll(".color-choice").forEach(button => {

        button.addEventListener("click", () => {

            note.style.backgroundColor = button.dataset.color;

            saveBoard();
        });

    });

    // NOTIZEN VERBINDEN

    note.addEventListener("click", event => {

        if (!connecting) return;

        if (
            event.target.tagName === "TEXTAREA" ||
            event.target.tagName === "BUTTON"
        ) return;

        if (!firstNote) {

            firstNote = note;
            note.classList.add("selected-note");

            saveStatus.textContent = "● Wähle die zweite Notiz";

        } else if (firstNote === note) {

            firstNote.classList.remove("selected-note");
            firstNote = null;

        } else {

            const alreadyConnected = connections.some(connection =>
                (connection.from === firstNote.dataset.id &&
                 connection.to === note.dataset.id) ||
                (connection.from === note.dataset.id &&
                 connection.to === firstNote.dataset.id)
            );

            if (!alreadyConnected) {
                connections.push({
                    from: firstNote.dataset.id,
                    to: note.dataset.id
                });
            }

            firstNote.classList.remove("selected-note");
            firstNote = null;

            connecting = false;

            document.getElementById("connectNotes")
                .classList.remove("active");

            document.getElementById("connectionHint")
                .classList.remove("visible");

            saveBoard();
        }
    });

    // NOTIZEN VERSCHIEBEN

    let dragging = false;
    let startX, startY;
    let originalX, originalY;

    note.addEventListener("pointerdown", event => {

        if (connecting) return;

        if (
            event.target.tagName === "TEXTAREA" ||
            event.target.tagName === "BUTTON"
        ) return;

        dragging = true;

        note.setPointerCapture(event.pointerId);

        startX = event.clientX;
        startY = event.clientY;

        originalX = parseFloat(note.style.left);
        originalY = parseFloat(note.style.top);

        note.style.zIndex = 100;
    });

    note.addEventListener("pointermove", event => {

        if (!dragging) return;

        const dx = (event.clientX - startX) / zoom;
        const dy = (event.clientY - startY) / zoom;

        note.style.left = originalX + dx + "px";
        note.style.top = originalY + dy + "px";

        drawConnections();
    });

    function stopDragging() {

        if (!dragging) return;

        dragging = false;
        note.style.zIndex = 1;

        saveBoard();
    }

    note.addEventListener("pointerup", stopDragging);
    note.addEventListener("pointercancel", stopDragging);

    board.appendChild(note);

    drawConnections();

    return note;
}

// =====================================
// NEUE NOTIZ
// =====================================

document.getElementById("addNote").addEventListener("click", () => {

    const x = (boardArea.scrollLeft + 350) / zoom;
    const y = (boardArea.scrollTop + 200) / zoom;

    const note = createNote(x, y);

    saveBoard();

    note.querySelector("textarea").focus();
});

document.getElementById("addNoteTool").addEventListener("click", () => {

    document.getElementById("addNote").click();

});

// =====================================
// TEXT HINZUFÜGEN
// =====================================

document.getElementById("addText").addEventListener("click", () => {

    const note = createNote(
        (boardArea.scrollLeft + 350) / zoom,
        (boardArea.scrollTop + 200) / zoom,
        "#ffffff",
        "Neuer Text..."
    );

    saveBoard();

    note.querySelector("textarea").focus();
});

// =====================================
// PFEILFUNKTION
// =====================================

document.getElementById("connectNotes").addEventListener("click", () => {

    connecting = !connecting;

    firstNote?.classList.remove("selected-note");

    firstNote = null;

    document.getElementById("connectNotes")
        .classList.toggle("active", connecting);

    document.getElementById("connectionHint")
        .classList.toggle("visible", connecting);

    saveStatus.textContent = connecting
        ? "● Verbindungsmodus aktiv"
        : "● Gespeichert";
});

// =====================================
// ZOOM
// =====================================

function updateZoom() {

    board.style.transform = `scale(${zoom})`;

    document.getElementById("zoomIndicator").textContent =
        Math.round(zoom * 100) + " %";
}

document.getElementById("zoomIn").addEventListener("click", () => {

    zoom = Math.min(zoom + 0.1, 1.8);

    updateZoom();
});

document.getElementById("zoomOut").addEventListener("click", () => {

    zoom = Math.max(zoom - 0.1, 0.5);

    updateZoom();
});

document.getElementById("resetZoom").addEventListener("click", () => {

    zoom = 1;

    updateZoom();
});

// =====================================
// BOARD LEEREN
// =====================================

document.getElementById("clearBoard").addEventListener("click", () => {

    if (!confirm("Möchtest du wirklich alle Notizen löschen?")) {
        return;
    }

    document.querySelectorAll(".note").forEach(note => note.remove());

    connections = [];
    firstNote = null;
    connecting = false;

    document.getElementById("connectNotes")
        .classList.remove("active");

    document.getElementById("connectionHint")
        .classList.remove("visible");

    saveBoard();
});

// =====================================
// DESIGNS WECHSELN
// =====================================

const themeSelect = document.getElementById("themeSelect");

function changeTheme(theme) {

    document.body.dataset.theme = theme;

    themeSelect.value = theme;

    localStorage.setItem("ideaboard-theme", theme);
}

themeSelect.addEventListener("change", event => {

    changeTheme(event.target.value);

});

// =====================================
// BOARD TITEL
// =====================================

document.getElementById("boardName")
    .addEventListener("input", saveBoard);

// =====================================
// DATEN LADEN
// =====================================

function loadBoard() {

    const savedTitle = localStorage.getItem("ideaboard-title");

    if (savedTitle) {
        document.getElementById("boardName").value = savedTitle;
    }

    const savedTheme =
        localStorage.getItem("ideaboard-theme") || "light";

    changeTheme(savedTheme);

    const savedNotes = JSON.parse(
        localStorage.getItem("ideaboard-notes") || "[]"
    );

    const savedConnections = JSON.parse(
        localStorage.getItem("ideaboard-connections") || "[]"
    );

    savedNotes.forEach(note => {

        createNote(
            note.x,
            note.y,
            note.color,
            note.text,
            note.id
        );

    });

    connections = savedConnections;

    drawConnections();
}

loadBoard();
