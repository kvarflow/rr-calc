/*
 * The Frag sheet (a sheet, sheets.js): every Pokémon of your run in this mode, in your Team, Box,
 * Box 2 or Trash, or fainted and gone, with where it was caught (from your .sav), the KOs it has
 * made in each level-cap arc (the run record, run_record.js, counts a KO in the arc you were in
 * when you beat that trainer) and its share of all your KOs. Sort by any column; export as CSV.
 */

var FRAGSHEET_SORT_KEY = "fragsheetSort";
var FRAG_STATUS_ORDER = {Team: 0, Box: 1, "Box 2": 2, Trash: 3, Fainted: 4, Gone: 5};

// Where and at what level a .sav Pokémon was caught, from the origin save_import.js keeps.
function getMetInfo(set) {
	var match = /^o:(\d+)\/(\d+)\//.exec((set && set.origin) || "");
	if (!match || typeof MAP_SECTIONS === "undefined") return {place: "", level: ""};
	var origins = +match[2];
	var place = MAP_SECTIONS.names[+match[1] - MAP_SECTIONS.first] || "";
	// Level 0: hatched from an egg.
	var level = origins & 0x7F;
	return {place: place || (level ? "" : "Egg"), level: level || ""};
}

/*
 * The run's Pokémon as rows: {key, setId, name, species, status, met, metLevel, kos: [per arc],
 * total, faintedBy, ability, nature}, and the arcs that have columns.
 */
function buildFragRows() {
	var record = readRunRecord();
	var sets = readCustomSets();
	var layout = resolveBoxLayout(sets, readBoxLayout());
	var arcs = getArcs();
	var kos = readTrainerKOs();
	var current = getProgressArc(arcs, kos);
	var rows = [];
	var byKey = {};
	var addRow = function (row) {
		row.kos = arcs.map(function () {
			return 0;
		});
		row.total = 0;
		rows.push(row);
		if (row.key) byKey[row.key] = row;
	};
	BOX_SECTIONS.forEach(function (section) {
		layout[section.key].forEach(function (setId) {
			var id = splitSetId(setId);
			var set = (sets[id.pokemonName] || {})[id.setName] || {};
			var key = getRunKey(setId);
			var mon = (key && record.mons[key]) || {};
			var met = getMetInfo(set);
			addRow({key: key, setId: setId, name: id.setName, species: id.pokemonName,
				status: mon.fainted ? "Fainted" : section.label, met: met.place, metLevel: met.level,
				faintedBy: mon.fainted ? mon.faintedBy || "" : "", ability: set.ability || "", nature: set.nature || ""});
		});
	});
	// Fainted or released since and no longer in the box: what the record kept of them.
	Object.keys(record.mons).forEach(function (key) {
		if (byKey[key]) return;
		var mon = record.mons[key];
		var made = record.frags.some(function (frag) {
			return frag.mon === key;
		});
		if (!mon.fainted && !made) return;
		addRow({key: key, setId: "", name: mon.name || "?", species: mon.name || "?", status: mon.fainted ? "Fainted" : "Gone",
			met: "", metLevel: "", faintedBy: mon.faintedBy || "", ability: "", nature: ""});
	});
	var shown = current;
	record.frags.forEach(function (frag) {
		var row = byKey[frag.mon];
		if (!row || !TRAINER_ORDER[frag.trainer]) return;
		var arc = getCountedArc(frag.trainer, arcs, current, kos);
		row.kos[arc]++;
		row.total++;
		shown = Math.max(shown, arc);
	});
	var all = rows.reduce(function (sum, row) {
		return sum + row.total;
	}, 0);
	rows.forEach(function (row) {
		row.share = all ? row.total / all : 0;
	});
	return {rows: rows, arcs: arcs.slice(0, shown + 1), totalKOs: all, started: record.started};
}

function getFragColumns(arcs) {
	var columns = [
		{key: "status", label: "Status", value: function (row) {
			return FRAG_STATUS_ORDER[row.status];
		}},
		{key: "sprite", label: "", sortable: false},
		{key: "name", label: "Name"},
		{key: "species", label: "Species"},
		{key: "met", label: "Met", value: function (row) {
			return row.met + " " + row.metLevel;
		}}
	];
	arcs.forEach(function (arc, i) {
		columns.push({key: "arc" + i, label: arc.name, title: arc.name + " Arc (level cap " + arc.cap + ")", numeric: true,
			value: function (row) {
				return row.kos[i];
			}});
	});
	return columns.concat([
		{key: "total", label: "KOs", numeric: true},
		{key: "share", label: "Share", numeric: true},
		{key: "faintedBy", label: "Fainted to"},
		{key: "ability", label: "Ability"},
		{key: "nature", label: "Nature"}
	]);
}

function fragCellText(row, column) {
	if (column.key === "share") return row.total ? Math.round(row.share * 100) + "%" : "";
	if (column.key === "met") return row.met + (row.metLevel ? " (Lv " + row.metLevel + ")" : "");
	var value = column.value ? column.value(row) : row[column.key];
	if (column.numeric) return value ? String(value) : "";
	return column.key === "status" ? row.status : String(value === undefined ? "" : value);
}

function sortFragRows(rows, columns, sort) {
	var column = columns.filter(function (c) {
		return c.key === sort.key;
	})[0] || columns[0];
	var value = column.value || function (row) {
		return row[column.key];
	};
	return rows.slice().sort(function (a, b) {
		var x = value(a);
		var y = value(b);
		var order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
		// Most KOs first within a status.
		return (sort.desc ? -order : order) || b.total - a.total || a.name.localeCompare(b.name);
	});
}

function exportFragCsv(rows, columns) {
	var shown = columns.filter(function (column) {
		return column.key !== "sprite";
	});
	var quote = function (text) {
		return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
	};
	var lines = [shown.map(function (column) {
		return quote(column.label);
	}).join(",")].concat(rows.map(function (row) {
		return shown.map(function (column) {
			return quote(column.numeric ? String((column.value ? column.value(row) : row[column.key]) || 0) : fragCellText(row, column));
		}).join(",");
	}));
	var link = $("<a></a>").attr({
		href: URL.createObjectURL(new Blob([lines.join("\n") + "\n"], {type: "text/csv"})),
		download: "frag-sheet-" + getPageMode() + ".csv"
	}).appendTo("body");
	link[0].click();
	link.remove();
}

function renderFragsheet(container) {
	var data = buildFragRows();
	var columns = getFragColumns(data.arcs);
	var sort = {key: "status", desc: false};
	try {
		sort = JSON.parse(readSetting(FRAGSHEET_SORT_KEY)) || sort;
	} catch (e) {}
	var fainted = data.rows.filter(function (row) {
		return row.status === "Fainted";
	}).length;
	var tools = $('<div class="fs-tools"></div>').appendTo(container);
	$('<span class="fs-summary"></span>').text(data.rows.length + " Pokémon · " + data.totalKOs + " KOs · " + fainted + " fainted" +
		(data.started ? " · run started " + new Date(data.started).toLocaleDateString() : "")).appendTo(tools);
	$('<button type="button" class="fs-export">Export CSV</button>').click(function () {
		exportFragCsv(sortFragRows(data.rows, columns, sort), columns);
	}).appendTo(tools);
	if (!data.rows.length) {
		container.append('<p class="fs-empty">No Pokémon yet: import your .sav or add sets to your box. KOs you mark with the KO button count here.</p>');
		return;
	}
	var scroll = $('<div class="fs-scroll"></div>').appendTo(container);
	var table = $('<table class="fs-table"></table>').appendTo(scroll);
	var draw = function () {
		table.empty();
		var head = $("<tr></tr>").appendTo($("<thead></thead>").appendTo(table));
		columns.forEach(function (column) {
			var th = $("<th></th>").text(column.label).attr("title", column.title || "").toggleClass("fs-numeric", !!column.numeric);
			if (column.sortable !== false) {
				th.addClass("fs-sortable").attr({tabindex: 0, "aria-sort": sort.key === column.key ? (sort.desc ? "descending" : "ascending") : "none"})
					.append(sort.key === column.key ? (sort.desc ? " ▼" : " ▲") : "")
					.on("click keydown", function (ev) {
						if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
						ev.preventDefault();
						// Numbers sort biggest first on the first click.
						sort = sort.key === column.key ? {key: column.key, desc: !sort.desc} : {key: column.key, desc: !!column.numeric};
						writeSetting(FRAGSHEET_SORT_KEY, JSON.stringify(sort));
						draw();
					});
			}
			head.append(th);
		});
		var body = $("<tbody></tbody>").appendTo(table);
		sortFragRows(data.rows, columns, sort).forEach(function (row) {
			var tr = $("<tr></tr>").toggleClass("fs-fainted", row.status === "Fainted" || row.status === "Gone").appendTo(body);
			columns.forEach(function (column) {
				var td = $("<td></td>").toggleClass("fs-numeric", !!column.numeric).appendTo(tr);
				if (column.key === "sprite") {
					td.append(createSpriteImage(row.species, function () {
						$(this).remove();
					}));
				} else if (column.key === "species") {
					td.append($('<span class="fs-species" role="button" tabindex="0" title="In the Dex"></span>').attr("data-species", row.species).text(row.species));
				} else if (column.key === "status") {
					td.append($('<span class="fs-status"></span>').attr("data-status", row.status).text(row.status === "Fainted" ? "✝ Fainted" : row.status));
				} else {
					td.text(fragCellText(row, column));
				}
			});
		});
	};
	draw();
}

if (typeof TRAINER_ORDER !== "undefined" && TRAINER_ORDER.length) {
	registerSheet({key: "frags", label: "Frag sheet", icon: "⚔️", render: renderFragsheet});
}
