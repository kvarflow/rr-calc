-- Radical Red -> damage calculator sync, for mGBA 0.10 or later on a computer.
--
-- In mGBA: Tools > Scripting..., then File > Load script... and pick this file. While it runs,
-- turn on "Emulator sync" in the calculator (Import / Export): it reads your party, the
-- opponent's and the battle (each side's HP, stat changes and status) from
-- http://127.0.0.1:31125/state and loads them into Pokemon 1 and 2.
--
-- The script only reads the game's memory; it changes nothing in the game.

local PORT = 31125
local SCRIPT_VERSION = 1

-- FireRed (US 1.0) addresses: Radical Red's own code still uses every one of them.
local ADDR = {
	gMain = 0x030030F0, -- inBattle: bit 1 of the byte at +0x439
	gBattleTypeFlags = 0x02022B4C,
	gBattleMons = 0x02023BE4, -- 0x58 bytes a battler
	gBattlersCount = 0x02023BCC,
	gBattlerPartyIndexes = 0x02023BCE, -- u16 a battler
	gPlayerPartyCount = 0x02024029,
	gPlayerParty = 0x02024284, -- 100 bytes a Pokemon, as the save stores them
	gEnemyPartyCount = 0x02024028,
	gEnemyParty = 0x0202402C,
	gTrainerBattleOpponent_A = 0x020386AE,
}
local PARTY_MON_SIZE = 100
local BATTLE_MON_SIZE = 0x58

local function hexRange(address, length)
	local out = {}
	for i = 0, length - 1 do
		out[#out + 1] = string.format("%02x", emu:read8(address + i))
	end
	return table.concat(out)
end

local function party(countAddress, address)
	local count = math.min(emu:read8(countAddress), 6)
	return string.format('{"count":%d,"hex":"%s"}', count, hexRange(address, 6 * PARTY_MON_SIZE))
end

-- A battler: species, HP, level, stat stages (HP, Atk, Def, Spe, SpA, SpD, accuracy, evasion; 6 is
-- no change), status (sleep turns in bits 0-2, then poison, burn, freeze, paralysis, toxic) and
-- personality.
local function battleMon(index)
	local base = ADDR.gBattleMons + index * BATTLE_MON_SIZE
	local stages = {}
	for stat = 0, 7 do
		stages[#stages + 1] = tostring(emu:read8(base + 0x18 + stat))
	end
	return string.format('{"species":%d,"hp":%d,"maxHp":%d,"level":%d,"stages":[%s],"status":%d,"pid":%d}',
		emu:read16(base), emu:read16(base + 0x28), emu:read16(base + 0x2C), emu:read8(base + 0x2A),
		table.concat(stages, ","), emu:read32(base + 0x4C), emu:read32(base + 0x48))
end

local function stateJson()
	local inBattle = (emu:read8(ADDR.gMain + 0x439) & 2) ~= 0
	local battlers = inBattle and math.min(emu:read8(ADDR.gBattlersCount), 4) or 0
	local indexes, mons = {}, {}
	for i = 0, battlers - 1 do
		indexes[#indexes + 1] = tostring(emu:read16(ADDR.gBattlerPartyIndexes + i * 2))
		mons[#mons + 1] = battleMon(i)
	end
	return string.format('{"game":"radicalred","script":%d,"inBattle":%s,"battleType":%d,"trainer":%d,' ..
		'"party":%s,"enemyParty":%s,"partyIndexes":[%s],"mons":[%s]}',
		SCRIPT_VERSION, tostring(inBattle), emu:read32(ADDR.gBattleTypeFlags), emu:read16(ADDR.gTrainerBattleOpponent_A),
		party(ADDR.gPlayerPartyCount, ADDR.gPlayerParty), party(ADDR.gEnemyPartyCount, ADDR.gEnemyParty),
		table.concat(indexes, ","), table.concat(mons, ","))
end

-- A tiny HTTP server: GET /state, GET /ping, and the preflight a browser sends from an https page.
local function respond(sock, status, body, contentType)
	local text = string.format("HTTP/1.1 %s\r\n" ..
		"Access-Control-Allow-Origin: *\r\n" ..
		"Access-Control-Allow-Methods: GET, OPTIONS\r\n" ..
		"Access-Control-Allow-Headers: *\r\n" ..
		"Access-Control-Allow-Private-Network: true\r\n" ..
		"Cache-Control: no-store\r\n" ..
		"Content-Type: %s\r\n" ..
		"Content-Length: %d\r\n" ..
		"Connection: close\r\n\r\n%s", status, contentType or "text/plain", #body, body)
	pcall(function() sock:send(text) end)
	pcall(function() sock:close() end)
end

local function handle(sock, request)
	local method, path = request:match("^(%u+) ([^ ]+)")
	path = path and path:gsub("%?.*$", "")
	if method == "OPTIONS" then
		respond(sock, "204 No Content", "")
	elseif method == "GET" and path == "/state" then
		local ok, json = pcall(stateJson)
		if ok then respond(sock, "200 OK", json, "application/json")
		else respond(sock, "500 Internal Server Error", tostring(json)) end
	elseif method == "GET" and path == "/ping" then
		respond(sock, "200 OK", "radicalred-sync " .. SCRIPT_VERSION)
	else
		respond(sock, "404 Not Found", "Not found")
	end
end

local server = nil

local function accept()
	local sock = server:accept()
	if not sock then return end
	local request = ""
	sock:add("received", function()
		while true do
			local chunk, err = sock:receive(1024)
			if chunk then
				request = request .. chunk
				if request:find("\r\n\r\n", 1, true) then
					handle(sock, request)
					return
				end
			else
				if err ~= socket.ERRORS.AGAIN then pcall(function() sock:close() end) end
				return
			end
		end
	end)
	sock:add("error", function() pcall(function() sock:close() end) end)
end

local function start()
	if server then return end
	local bound, err = socket.bind("127.0.0.1", PORT)
	if not bound then
		console:error("Radical Red sync: could not use port " .. PORT .. " (" .. tostring(err) .. ")")
		return
	end
	local _, listenErr = bound:listen()
	if listenErr then
		console:error("Radical Red sync: " .. tostring(listenErr))
		return
	end
	server = bound
	server:add("received", accept)
	console:log("Radical Red sync: listening on http://127.0.0.1:" .. PORT .. ". Turn on Emulator sync in the calculator.")
end

start()
