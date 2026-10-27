#!/usr/bin/env python3
"""Radical Red -> damage calculator sync, for RetroArch (the Thor, a phone or a computer).

RetroArch can read a game's memory for other programs ("Network Commands"), but only over UDP,
which a web page cannot use. This script asks RetroArch for Radical Red's party and battle and
serves them to the calculator on http://127.0.0.1:31125/state, as the mGBA script does.

1. In RetroArch: Settings > Network > Network Commands: On (port 55355). Use the mGBA core.
2. Run this on the same device: on Android, in Termux (`pkg install python`, then
   `python retroarch_sync.py`); on a computer, `python3 retroarch_sync.py`.
3. In the calculator: Import / Export > Emulator sync.

It only reads the game's memory; it changes nothing in the game. Python 3, nothing to install.
"""
import json
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 31125
RETROARCH = ("127.0.0.1", 55355)
SCRIPT_VERSION = 1

# FireRed (US 1.0) addresses: Radical Red's own code still uses every one of them.
ADDR = {
    "gMain": 0x030030F0,  # inBattle: bit 1 of the byte at +0x439
    "gBattleTypeFlags": 0x02022B4C,
    "gBattleMons": 0x02023BE4,  # 0x58 bytes a battler
    "gBattlersCount": 0x02023BCC,
    "gBattlerPartyIndexes": 0x02023BCE,  # u16 a battler
    "gPlayerPartyCount": 0x02024029,
    "gPlayerParty": 0x02024284,  # 100 bytes a Pokemon, as the save stores them
    "gEnemyPartyCount": 0x02024028,
    "gEnemyParty": 0x0202402C,
    "gTrainerBattleOpponent_A": 0x020386AE,
}
PARTY_MON_SIZE = 100
BATTLE_MON_SIZE = 0x58
CHUNK = 256


class RetroArchError(Exception):
    pass


def read(address, length):
    """`length` bytes of the game's memory from RetroArch (READ_CORE_MEMORY, a chunk at a time)."""
    data = bytearray()
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(0.5)
        for start in range(address, address + length, CHUNK):
            size = min(CHUNK, address + length - start)
            sock.sendto(("READ_CORE_MEMORY %x %d\n" % (start, size)).encode(), RETROARCH)
            try:
                reply = sock.recv(65536).decode(errors="replace").split()
            except socket.timeout:
                raise RetroArchError("RetroArch did not answer: is a game running, with Network Commands on?")
            # "READ_CORE_MEMORY <address> <byte> <byte>...", or "<address> -1 <why>".
            if len(reply) < 3 or reply[0] != "READ_CORE_MEMORY" or reply[2] == "-1":
                raise RetroArchError("RetroArch could not read the game: " + " ".join(reply[3:] or reply))
            data.extend(int(byte, 16) for byte in reply[2:2 + size])
    return bytes(data)


def u16(data, at=0):
    return int.from_bytes(data[at:at + 2], "little")


def u32(data, at=0):
    return int.from_bytes(data[at:at + 4], "little")


def party(count_address, address):
    count = min(read(count_address, 1)[0], 6)
    return {"count": count, "hex": read(address, 6 * PARTY_MON_SIZE).hex()}


def state():
    """The same as the mGBA script's /state."""
    in_battle = bool(read(ADDR["gMain"] + 0x439, 1)[0] & 2)
    battlers = min(read(ADDR["gBattlersCount"], 1)[0], 4) if in_battle else 0
    indexes, mons = [], []
    if battlers:
        index_bytes = read(ADDR["gBattlerPartyIndexes"], 2 * battlers)
        battle = read(ADDR["gBattleMons"], BATTLE_MON_SIZE * battlers)
        for i in range(battlers):
            indexes.append(u16(index_bytes, 2 * i))
            mon = battle[i * BATTLE_MON_SIZE:(i + 1) * BATTLE_MON_SIZE]
            mons.append({"species": u16(mon), "hp": u16(mon, 0x28), "maxHp": u16(mon, 0x2C), "level": mon[0x2A],
                         "stages": list(mon[0x18:0x20]), "status": u32(mon, 0x4C), "pid": u32(mon, 0x48)})
    return {
        "game": "radicalred", "script": SCRIPT_VERSION, "via": "retroarch", "inBattle": in_battle,
        "battleType": u32(read(ADDR["gBattleTypeFlags"], 4)), "trainer": u16(read(ADDR["gTrainerBattleOpponent_A"], 2)),
        "party": party(ADDR["gPlayerPartyCount"], ADDR["gPlayerParty"]),
        "enemyParty": party(ADDR["gEnemyPartyCount"], ADDR["gEnemyParty"]),
        "partyIndexes": indexes, "mons": mons,
    }


class Handler(BaseHTTPRequestHandler):
    def headers_out(self, status, content_type, length):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        # A page on the internet may read this one on the device (Chrome asks first).
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.end_headers()

    def do_OPTIONS(self):
        self.headers_out(204, "text/plain", 0)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/ping":
            body, status, kind = ("radicalred-sync %d (retroarch)" % SCRIPT_VERSION).encode(), 200, "text/plain"
        elif path == "/state":
            try:
                body, status, kind = json.dumps(state()).encode(), 200, "application/json"
            except (RetroArchError, OSError) as error:
                body, status, kind = str(error).encode(), 503, "text/plain"
        else:
            body, status, kind = b"Not found", 404, "text/plain"
        self.headers_out(status, kind, len(body))
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def main():
    global RETROARCH
    # Another Network Commands port than 55355, if you changed it.
    if len(sys.argv) > 1:
        RETROARCH = ("127.0.0.1", int(sys.argv[1]))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Radical Red sync: reading RetroArch on port %d, serving http://127.0.0.1:%d." % (RETROARCH[1], PORT))
    print("Turn on Emulator sync in the calculator. Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
