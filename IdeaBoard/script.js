
const board = document.getElementById("board");
const boardArea = document.getElementById("boardArea");
const saveStatus = document.getElementById("saveStatus");

let zoom = 1;
let noteCount = 0;

const colors = [
    "#fff0a8",
    "#ffc9d9",
    "#c9e9ff",
    "#d4f5d0",
    "#e4d5ff",
    "#ffffff"
];

// Board speichern
function saveBoard() {
    const notes = [...document.querySelectorAll(".note")].map(note => ({
        id: note.dataset.id,
        x: parseFloat(note.style.left),
        y: parseFloat(note.style.top),
        color: note.style.backgroundColor,
        text: note.querySelector("textarea").value
    }));

    localStorage.setItem("ideaboard-notes", JSON.stringify(notes));
    localStorage.setItem(
        "ideaboard-title",
        document.getElementById("boardName").value
    );

    saveStatus.textContent = "● Gespeichert";
}

// Notiz erstellen
function createNote(x = 450, y = 200, color, text = "") {
    noteCount++;

    const note = document.createElement("div");
    note.className = "note";
    note.dataset.id = Date.now() + "-" + noteCount;

    note.style.left = x + "px";
    note.style.top = y + "px";
    note.style.backgroundColor =
        color || colors[Math.floor(Math.random() * colors.length)];

    note.innerHTML = `
        <div class="note-header">
            <span>NOTIZ</span>
            <button class="delete-note" title="Notiz löschen">×</button>
        </div>

        <textarea placeholder="Schreibe deine Idee hier..."></textarea>

        <div class="note-colors">
            ${colors.map(c => `
                <button class="color-choice"
                    style="background:${c}"
                    data-color="${c}"
                    title="Farbe ändern">
                </button>
            `).join("")}
        </div>
    `;

    const textarea = note.querySelector("textarea");
    textarea.value = text;

    // Textänderungen speichern
    textarea.addEventListener("input", () => {
        saveStatus.textContent = "● Speichern...";
        saveBoard();
    });

    // Notiz löschen
    note.querySelector(".delete-note").addEventListener("click", () => {
        note.remove();
        saveBoard();
    });

    // Farbe ändern
    note.querySelectorAll(".color-choice").forEach(button => {
        button.addEventListener("click", () => {
            note.style.backgroundColor = button.dataset.color;
            saveBoard();
        });
    });

    // Notiz verschieben
    let dragging = false;
    let startX, startY, originalX, originalY;

    note.addEventListener("pointerdown", event => {
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
    });

    note.addEventListener("pointerup", () => {
        dragging = false;
        note.style.zIndex = 1;
        saveBoard();
    });

    board.appendChild(note);
    saveBoard();

    return note;
}

// Neue Notiz
document.getElementById("addNote").addEventListener("click", () => {
    const x = (boardArea.scrollLeft + 350) / zoom;
    const y = (boardArea.scrollTop + 200) / zoom;
    const note = createNote(x, y);
    note.querySelector("textarea").focus();
});

document.getElementById("addNoteTool").addEventListener("click", () => {
    document.getElementById("addNote").click();
});

// Text hinzufügen
document.getElementById("addText").addEventListener("click", () => {
    const note = createNote(
        (boardArea.scrollLeft + 350) / zoom,
        (boardArea.scrollTop + 200) / zoom,
        "#ffffff",
        "Neuer Text..."
    );
    note.querySelector("textarea").focus();
});

// Zoom aktualisieren
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

// Board leeren
document.getElementById("clearBoard").addEventListener("click", () => {
    if (!confirm("Möchtest du wirklich alle Notizen löschen?")) return;

    document.querySelectorAll(".note").forEach(note => note.remove());
    saveBoard();
});

// Board-Titel speichern
document.getElementById("boardName").addEventListener("input", saveBoard);

// Gespeicherte Daten laden
function loadBoard() {
    const savedNotes = JSON.parse(
        localStorage.getItem("ideaboard-notes") || "[]"
    );

    const savedTitle = localStorage.getItem("ideaboard-title");

    if (savedTitle) {
        document.getElementById("boardName").value = savedTitle;
    }

    savedNotes.forEach(note => {
        createNote(note.x, note.y, note.color, note.text);
    });
}

loadBoard();
