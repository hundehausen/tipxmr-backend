#!/usr/bin/env node

/**
 * Streamer Socket Tester REPL.
 * 
 * This modules implements a very basic Read-Eval-Print-Loop to directly
 * communicate with the streamer facing backend e.g. the socket listening for
 * incoming streamer events.
 * Instead of dispatching a full-blown donation via the tipxmr-frontend this
 * simple cli script can be used.
 */
const repl = require("repl");
const io = require("socket.io-client");

const replServer = repl.start({ prompt: "> " });
const socket = io("http://localhost:3000/streamer");

/**
 * update - Command
 * 
 * Dispatches an update of new animation settings
 * 
 * Example:
 * .update { "color": "red" }
 */
replServer.defineCommand("update", {
  action(line) {
    socket.emit("XXX_update_settings", JSON.parse(line));
    this.displayPrompt();
  },
});

/**
 * donate - Command
 * 
 * Dispatches a donation containing name, message and amount
 * 
 * Example:
 * .donate Nicolas van Saberhagen | CryptoNote v2.0 rocks! | 18042014
 */
replServer.defineCommand("donate", {
  action(line) {
    const [name, message, amount] = line.split("|");
    socket.emit("XXX_send_donation", { name, message, amount });
    this.displayPrompt();
  },
});
