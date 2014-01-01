var fs = require('fs');
var util = require('util');


// ====== Include scriptcard.js functions ======

function read(f) {
    return fs.readFileSync(f).toString();
};
function include(f) {
    eval.apply(global, [read(f)]);  // note: we are executing nearly arbitrary code here
};

include('scriptcard.js');   // base game logic

// ====== Include packs ======

// give our strings .endswith(suffix)
String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

// find all packs in the 'packs' directory and load them in
var packFileNames = fs.readdirSync(__dirname +'/packs');
var packNames = [];
var packs = {}; // a dict from pack name to pack factory functions
for (var i in packFileNames) {
    var fileName = packFileNames[i];
    if (!fileName.endsWith('.js')) {
        console.error('non .js file in pack folder: ' + fileName);
        continue;
    }
    var packName = fileName.substring(0, fileName.length-3); // remove '.js'
    packNames.push(packName);

    // load the pack
    include(packFilePath(packName)); // that file must have a definition for 'makePack'
    packs[packName] = makePack;
}

function packFilePath(packName) {
    return 'packs/'+packName+'.js';
}


// ====== Webserver hander ======

var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
io.set('log level', 1);  // SILENCE!
app.listen(9000);

// sends a file to the user
function sendFile(res, fileName) {
    fs.readFile(
        __dirname +'/'+ fileName,
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading: ' + fileName);
            }

            res.writeHead(200);
            res.end(data);
        }
    );
}

function handler(req, res) {
    var url = req.url;
    if      (url == '/'             ) sendFile(res, 'index.html'    );
    else if (url == '/scriptcard.js') sendFile(res, 'scriptcard.js' );
    else if (url == '/favicon.ico'  ) { }
    else console.log('bad URL: ' + url);
}


// ====== Socket server ======

// makes a game state, which is shared with another player
var exisitingState = null;
function matchMake(packNames) {
    if (exisitingState) {
        var ret = { state: exisitingState, playerIndex: 1};
        exisitingState = null;
        return ret;
    }
    else {
        exisitingState = makeState();
        for (var i in packNames) {
            var packName = packNames[i];
            if (!packName in packs) {
                console.warn('unknown packName: ' + packName);
            }
            loadPackIntoState(exisitingState, packs[packName](), packName);
        }
        return { state: exisitingState, playerIndex: 0};
    }
}

io.sockets.on('connection', function (socket) {
    var packNames = ['cards', 'consolelog']; // this may be sent by the user
    var match = matchMake(packNames);
    var state = match.state;
    var playerIndex = match.playerIndex;
    var player = state.players[playerIndex]

    // load the pack

    socket.join(match.machID); // so we can talk to our partners

    socket.emit('initialState', {state: state, playerIndex: playerIndex});

    socket.on('event', function (event) {
        if (!event.name)    {
            console.error('event without name');
            return;
        }

        // relay to opponent(s)
        socket.broadcast.to(match.machID).emit('event', event);

        applyEvent(state, event);    // change the state
    });
    socket.on('playerReady', function () {
        player.ready = true;
        // check whether all are ready
        allReady = true;
        for (var i in state.players) {
            if (!state.players[i].ready) {
                allReady = false;
                break;
            }
        }

        console.log('one ready')
        if (!allReady) return;
        console.log('both ready')

        // start the game
        applyEvent(state, makeEvent(state, 'gameSetup'));
        applyEvent(state, makeEvent(state, 'gameStart'));
    });
});

console.log('running');
