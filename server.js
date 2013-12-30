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
    if      (url == '/'             ) sendFile(res, 'index.html'        );
    else if (url == '/scriptcard.js') sendFile(res, 'scriptcard.js' );
    else if (url == '/favicon.ico'  ) { }
    else console.log('bad URL: ' + url);
}


// ====== Socket server ======

// makes a game state, which is shared with another player
var exisitingState = null;
function matchMake() {
    if (exisitingState) {
        var ret = { state: exisitingState, player: 1};
        exisitingState = null;
        return ret;
    }
    else {
        exisitingState = makeState();
        return { state: exisitingState, player: 0};
    }
}

io.sockets.on('connection', function (socket) {
    var match = matchMake();
    var player = match.player;
    var state = match.state;

    // load the pack
    var packNames = ['cards', 'consolelog']; // this may be sent by the user
    for (var i in packNames) {
        var packName = packNames[i];
        if (!packName in packs) {
            console.warn('unknown packName: ' + packName);
        }
        loadPackIntoState(state, packs[packName](), packName);
    }

    socket.join(match.machID); // so we can talk to our partners

    socket.emit('state', {state: state});
    socket.emit('player', {player: player});
    socket.on('event', function (event) {
        if (!event.name)    {
            console.error('event without name');
            return;
        }

        // relay to opponent(s)
        socket.broadcast.to(match.machID).emit('event', event);

        applyEvent(state, event);    // change the state
    });
});

console.log('running');
