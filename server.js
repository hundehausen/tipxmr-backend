const io = require("socket.io")(3000, { origins: "*:*" });
const streamerNamespace = io.of("/streamer");
const donatorNamespace = io.of("/donator");
const db = require("./db");

// ===============================================================
// Streamer Namespace
// ===============================================================

streamerNamespace.on("connection", (socket) => {
  // streamer requests config at login by giving his hashedSeed
  socket.on("getStreamerConfig", (hashedSeed) => {});

  // streamer sends info
  socket.on("streamerInfo", (streamerInfo) =>
    onStreamerInfo(socket, streamerInfo)
  );

  // streamer return subaddress
  socket.on("subaddressToBackend", (data) => {
    onSubaddressToBackend(data);
  });

  // streamer wallet recieved donation
  socket.on("paymentRecieved", (data) => {});

  // streamer disconnects
  socket.on("disconnect", () => onStreamerDisconnectOrTimeout(socket));

  // streamer changes his config, update db
  socket.on("updateConfig", (config) => {});
});

// ===============================================================
// Donator Namespace
// ===============================================================

donatorNamespace.on("connection", (socket) => {
  // donator requestes info about streamer
  socket.on("getStreamer", (streamer) => {
    onGetStreamer(socket.id, streamer);
  });

  // donator requests Subaddress
  socket.on("getSubaddress", (data) => {
    onGetSubaddress(data);
  });

  // donator disconnects
  socket.on("disconnect", () => {
    onDonatorDisconnectOrTimeout(socket);
  });
});

// ===============================================================
// All Functions
// ===============================================================

// callbacks streamer
function onStreamerInfo(socket, streamerInfo) {
  db.addStreamer(socket.id, streamerInfo);
}

function onSubaddressToBackend(data) {
  console.log(
    "New subaddress from " + data.displayName + ": " + data.subaddress
  );
  io.to(data.donatorSocketId).emit("subaddressToDonator", data);
}

async function onStreamerDisconnectOrTimeout(socket) {
  const disconnectedStreamer = await db.getStreamerBySocketId(socket.id);
  if (disconnectedStreamer !== null) {
    db.updateOnlineStatusOfStreamer(disconnectedStreamer, false);
    console.log(
      "streamer: " + disconnectedStreamer.displayName + " disconnected"
    );
  } else {
    console.log("Undefined streamer disconnected");
  }
}

// donator callbacks
async function onGetStreamer(donatorSocketId, userName) {
  console.log(
    "Donator (" +
      donatorSocketId +
      ") requested streamer info from " +
      userName +
      "."
  );
  const requestedStreamer = await db.getStreamerByUsername(userName);
  console.log("requestedStreamer", requestedStreamer);
  // strip down relevant information for donator
  const returnStreamerToDonator = {
    userName: requestedStreamer.docs[0].userName,
    displayName: requestedStreamer.docs[0].displayName,
    hashedSeed: requestedStreamer.docs[0].hashedSeed,
    isOnline: requestedStreamer.docs[0].isOnline,
  };
  console.log("returnStreamerToDonator", returnStreamerToDonator);
  io.to(donatorSocketId).emit("recieveStreamer", returnStreamerToDonator);
}

async function onGetSubaddress(data) {
  console.log(
    data.donor + " requested subaddress of streamer: " + data.displayName
  );
  console.log("Data", data);
  const requestedStreamer = await db.getStreamerByUsername(data.userName);
  console.log("Requestes Streamer: ");
  console.dir(requestedStreamer);
  if (requestedStreamer !== undefined && requestedStreamer.isOnline === true) {
    // add socketID to data object, so the backend knows where to send the subaddress
    data.donatorSocketId = socket.id;
  }
  io.to(requestedStreamer.streamerSocketId).emit("createSubaddress", data);
}

function onDonatorDisconnectOrTimeout(socket) {
  console.log("donator (" + socket.id + ") disconnected");
}
