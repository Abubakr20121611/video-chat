const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const MAX_USERS = 5;
const ROOM_COUNT = 10;

const rooms = new Map();

for (let i = 1; i <= ROOM_COUNT; i++) {
    rooms.set(i, new Map());
}

let nextUserId = 1;

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcastRooms() {
    const data = {
        type: "rooms",
        rooms: [...rooms.entries()].map(([id, users]) => ({
            id,
            count: users.size,
            max: MAX_USERS
        }))
    };

    for (const client of wss.clients) {
        send(client, data);
    }
}

function leaveRoom(ws) {
    if (!ws.roomId) return;

    const room = rooms.get(ws.roomId);

    if (room) {
        room.delete(ws.id);

        for (const user of room.values()) {
            send(user.ws, {
                type: "user-left",
                userId: ws.id
            });
        }
    }

    ws.roomId = null;
    broadcastRooms();
}

const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
        const file = path.join(__dirname, "index.html");

        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end("index.html topilmadi");
                return;
            }

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });

            res.end(data);
        });

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {

    ws.id = "user-" + nextUserId++;
    ws.roomId = null;
    ws.name = "";

    send(ws, {
        type: "connected",
        userId: ws.id
    });

    send(ws, {
        type: "rooms",
        rooms: [...rooms.entries()].map(([id, users]) => ({
            id,
            count: users.size,
            max: MAX_USERS
        }))
    });

    ws.on("message", message => {

        let data;

        try {
            data = JSON.parse(message);
        } catch {
            return;
        }

        // JOIN ROOM
        if (data.type === "join-room") {

            const roomId = Number(data.roomId);
            const name = String(data.name || "")
                .trim()
                .slice(0, 25);

            if (!rooms.has(roomId)) {
                send(ws, {
                    type: "error",
                    message: "SERVER topilmadi."
                });
                return;
            }

            if (!name) {
                send(ws, {
                    type: "error",
                    message: "Ismingizni kiriting."
                });
                return;
            }

            const room = rooms.get(roomId);

            if (room.size >= MAX_USERS) {
                send(ws, {
                    type: "error",
                    message: "Bu SERVER to‘la."
                });
                return;
            }

            leaveRoom(ws);

            const existingUsers = [...room.values()].map(user => ({
                userId: user.userId,
                name: user.name
            }));

            const user = {
                userId: ws.id,
                name,
                ws
            };

            room.set(ws.id, user);
            ws.roomId = roomId;
            ws.name = name;

            send(ws, {
                type: "room-joined",
                roomId,
                userId: ws.id,
                users: existingUsers
            });

            for (const existing of room.values()) {
                if (existing.userId !== ws.id) {
                    send(existing.ws, {
                        type: "user-joined",
                        userId: ws.id,
                        name
                    });
                }
            }

            broadcastRooms();
            return;
        }

        // WEBRTC SIGNAL
        if (data.type === "signal") {

            if (!ws.roomId) return;

            const room = rooms.get(ws.roomId);

            if (!room) return;

            const target = room.get(data.target);

            if (!target) return;

            send(target.ws, {
                type: "signal",
                from: ws.id,
                data: data.data
            });

            return;
        }

        // LEAVE
        if (data.type === "leave-room") {
            leaveRoom(ws);
            return;
        }
    });

    ws.on("close", () => {
        leaveRoom(ws);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("================================");
    console.log("      VIDEO CHAT SERVER");
    console.log("================================");
    console.log("Port:", PORT);
    console.log("10 ta SERVER");
    console.log("Har bir SERVER: 5 kishi");
});