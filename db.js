// setting up the db
const { v4: generateUUID } = require("uuid");
let PouchDB = require("pouchdb");
const monerojs = require("monero-javascript");
let daemon = monerojs.connectToDaemonRpc(
  "http://node.cryptocano.de:38081",
  "superuser",
  "abctesting123"
);

PouchDB.plugin(require("pouchdb-upsert"));
PouchDB.plugin(require("pouchdb-find"));
PouchDB.plugin(require("pouchdb-adapter-memory"));

let db = new PouchDB("streamers", { adapter: "memory" });

const testStreamers = require("./data/streamerTestDB");

// return code masks
function return_success(message, data = {}) {
  return {
    type: "success",
    message,
    data,
  };
}

function return_error(message, error = {}) {
  return {
    type: "error",
    message,
    error,
  };
}

// ===============================================================
// DB operations
// ===============================================================

async function getStreamer(key, value) {
  switch (key) {
    case "id":
      try {
        const streamer = await db.get(value);
        console.log("Found streamer", streamer);
        return return_success(
          `Streamer (${streamer.userName}) found`,
          streamer
        );
      } catch (err) {
        console.log(err);
        return return_error("Streamer not found by hashedSeed", err);
      }
    case "userName":
      try {
        const streamer = await db.find({
          selector: {
            userName: { $eq: value }, // make sure the userName is lowercase
          },
        });
        return return_success(
          `Streamer (${streamer.userName}) found`,
          streamer
        );
      } catch (err) {
        console.log(err);
        return return_error("Streamer not found by userName", err);
      }
    case "socketId":
      try {
        const streamer = await db.find({
          selector: {
            streamerSocketId: { $eq: value },
          },
        });
        return return_success(
          `Streamer (${streamer.userName}) found`,
          streamer
        );
      } catch (err) {
        console.log(err);
        return return_error("Streamer not found by streamerSocketId", err);
      }
    default:
      try {
        const streamer = await db.find({
          selector: {
            [key]: { $eq: value },
          },
        });
        return return_success(
          `Streamer (${streamer.userName}) found by ${key}`,
          streamer[0]
        );
      } catch (err) {
        console.log(err);
        return return_error(`Streamer not found by ${key}`, err);
      }
  }
}

// add a new streamer (register process), username needs to be unique
// SUGAR version
async function addStreamer(socketId, streamerConfig) {
  try {
    // step 1: try to get the user with the username
    const response = await getStreamer("userName", streamerConfig.userName);
    // console.log(userDoc);
    if (response.type === "success") {
      console.log(streamerConfig.userName + " is taken");
      return return_error("username_taken");
    } else {
      // step 2: if there is nobody with that username, create the object in the db
      streamerConfig.streamerSocketId = socketId;
      //streamerConfig.isOnline = true;
      streamerConfig._id = streamerConfig.hashedSeed;
      streamerConfig.restoreHeight = await daemon.getHeight();
      streamerConfig.creationDate = new Date();
      const newStreamer = db.putIfNotExists(streamerConfig);
      console.log(streamerConfig.userName + " successfully created");
      return return_success("new_user_created", newStreamer); // keep in mind the userDoc is in 'data'
    }
  } catch (err) {
    console.log("Something went wrong with addStreamer", err);
    return return_error("Something went wrong with addStreamer", err);
  }
}

async function updateStreamer(newStreamerConfig) {
  // can only update existing entries
  try {
    console.log("Updated streamer: " + newStreamerConfig.displayName);
    return db.upsert(newStreamerConfig._id, () => {
      return newStreamerConfig;
    });
  } catch (err) {
    console.log("Error in updateStreamer", err);
    return return_error("Error in updateStreamer", err);
  }
}

// update online status of streamer
async function updateOnlineStatusOfStreamer(hashedSeed, newOnlineStatus) {
  // can only update existing entries
  try {
    let streamer = await db.get(hashedSeed);
    streamer.isOnline = newOnlineStatus;
    return db.upsert(streamer._id, function () {
      if (newOnlineStatus) {
        console.log(streamer.displayName + " went online");
      } else {
        console.log(streamer.displayName + " went offline");
      }
      return streamer;
    });
  } catch (err) {
    console.log("Error in updateOnlineStatusOfStreamer", err);
    return return_error("Error in updateOnlineStatusOfStreamer", err);
  }
}

// display all information of all streamers
// SUGAR version
async function showAll() {
  try {
    const wholeDB = await db.allDocs({ include_docs: true });
    console.log("here is the entire DB");
    console.dir(wholeDB.rows, { depth: 4 });
  } catch (err) {
    console.log("Something went wrong with showAll", err);
    return return_error("Something went wrong with showAll", err);
  }
}

const where = (selector) => db.find({ selector });

const generateAnimationId = () => generateUUID().split("-").join("");

async function populateTestStreamers() {
  const streamers = testStreamers
    .filter((testStreamer) => Object.keys(testStreamer).length)
    .map((testStreamer) => {
      const animationId = generateAnimationId();
      console.log(animationId);
      return {
        ...testStreamer,
        animationId,
        _id: testStreamer.hashedSeed,
      };
    });

  console.log("Populating test steamer data...");
  return db
    .bulkDocs(streamers)
    .then(() => console.log("success"))
    .catch(() => console.error("failed"));
}

const hasStreamingSession = (id) =>
  where({ animationId: { $eq: id } }).then((result) =>
    Boolean(result.docs.length)
  );

async function getAllOnlineStreamers() {
  // index
  try {
    var result = await db.createIndex({
      index: {
        fields: ["displayName", "isOnline"],
        ddoc: "name_index",
      },
    });

    const onlineStreamers = await db.find({
      selector: {
        displayName: { $exists: true },
        isOnline: { $eq: true },
      },
      use_index: "name_index",
      sort: ["displayName"],

      fields: [
        "_id",
        "displayName",
        "userName",
        "isOnline",
        "profilePicture",
        "stream.url",
        "stream.description",
        "stream.category",
        "stream.language",
        "stream.platform",
        "animationSettings.showGoal",
        "animationSettings.goal",
        "animationSettings.goalProgress",
      ],
    });
    return onlineStreamers.docs;
  } catch (err) {
    console.log("Something went wrong with getAllOnlineStreamers", err);
    return return_error("Something went wrong with getAllOnlineStreamers", err);
  }
}

async function test() {
  console.log(await getStreamer("displayName", "AlexAnarcho"));
}
populateTestStreamers().then(test);

module.exports = {
  addStreamer,
  getStreamer,
  updateStreamer,
  updateOnlineStatusOfStreamer,
  showAll,
  populateTestStreamers,
  hasStreamingSession,
  getAllOnlineStreamers,
};
