var fs = require('fs');
var util = require('util');

// ====== Include scriptcard.js functions ======

function read(f) {
    return fs.readFileSync(f).toString();
};
function include(f) {
    try {
        eval.apply(global, [read(f)]);  // note: we are executing nearly arbitrary code here
    }
    catch (e) {
        throw new Error('Error in file: ' + f);
    }
};



// ====== Load all packs ======

function printPacks() {
    console.log('packs:');
    for (var i in packNames) {
        var packName = packNames[i];
        var pack = packs[packName]
        console.log('   '+packName + ': ' + JSON.stringify(pack));
    }
}

// give our strings .endswith(suffix)
String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

function packFilePath(packName) {
    return 'packs/'+packName+'.js';
}

// find all packs in the 'packs' directory and load them in
var packFolderFiles = fs.readdirSync(__dirname +'/packs');

// ensure the base pack is loaded as the first package start
var basePackName = 'base.js';
packFolderFiles.splice(packFolderFiles.indexOf(basePackName), 1);
packFolderFiles.unshift(basePackName)

var packNames = [];
for (var i in packFolderFiles) {
    var fileName = packFolderFiles[i];
    if (!fileName.endsWith('.js')) {
        console.error('non .js file in pack folder: ' + fileName);
        continue;
    }
    var packName = fileName.substring(0, fileName.length-3); // remove '.js'
    packNames.push(packName);

}

// load the packs and set them to be available in requirejs
var packs = {}; // a dict from pack name to pack factory functions
var requirejs = require('requirejs');
var requirejsPaths = {};
function loadPack(packName) {
    var packPath = packFilePath(packName);
    requirejsPaths[packPath] = packPath;
    requirejs([packPath], function (pack) {
        packs[packName] = pack;
        // console.log('loaded pack: ' + packName);
        // console.log('packs L: ' +JSON.stringify(packs));
    });
};
for (var i in packNames) {
    loadPack(packNames[i]); // we call a function as we need packName for a closure
}

requirejsPaths['scriptcard.js'] = 'scriptcard.js';
requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname,
    // paths: requirejsPaths,
});

console.log('packNames1: ' + JSON.stringify(packNames));






// ====== Webserver hander ======


var app = require('http').createServer(handler);//.listen();
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
                console.log('Error loading: ' + fileName);
                return res.end('Error loading: ' + fileName);
            }

            var contentType = 'text/html';
            if (fileName.endsWith('.js' )) contentType = 'text/javascript';
            if (fileName.endsWith('.css')) contentType = 'text/css';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    );
}

function throw404(res) {
    res.writeHead(404, {
        "Content-Type": "text/plain"
    });
    res.write("404 Not Found\n");
    res.end();
}


var routing = {
    '': 'index.html',
    '/': 'index.html',
    '/client.js': 'client.js',
    '/jquery.js': 'jquery2.js',
    '/index.html': 'index.html',
    '/scriptcard.js' : 'scriptcard.js',
    '/jsonStringify.js' : 'jsonStringify.js',
    '/require.js': 'node_modules/requirejs/require.js',
    '/css/bootstrap.min.css': '/css/bootstrap.min.css',
};
for (var i in packNames) { // add the packs to routing
    var packPath = packFilePath(packNames[i]);
    routing['/'+packPath] = packPath;
}
console.log('routing: '+ JSON.stringify(routing));

function handler(req, res) {
    var url = req.url;
    console.log('URL: ' + url);
    if (url in routing) sendFile(res, routing[url]);
    else if (url == '/favicon.ico'  ) { }
    // else if (url.substring(0, 7) == '/packs/') {
    //     // url should look like '/packs/cards.js'
    //     var packName = url.substring(7).split('.js')[0]; // 'cards'
    //     if (packNames.indexOf(packName) < 0) {
    //         console.log('bad pack URL: ' + url);
    //         throw404(res);
    //     }
    //     else {
    //         sendFile(res, packFilePath(packName));
    //     }
    // }
    else {
        console.log('bad URL: ' + url);
        throw404(res);
    }
}






// ====== Socket server ======

requirejs(['scriptcard.js', 'jsonStringify.js'], function(scriptCard, jsonStringify) {
    var matchID = 0;

    function makePlayer(name) {
        return {
            name: name,
            ready: false,
        };
    }

    function makeState() {
        matchID += 1;
        var state = {
            players: [
                makePlayer('Player 1'),
                makePlayer('Player 2')
            ],
            currentPlayer: 0, // player 1
            stack: [],
            matchID: "match"+matchID,
            triggers: {
                pre: {},
                post: {}
            },
            nextEventID: 1,
            playing: true,  // whether the game allows player actions at the moment
            packNames: [],  // this variable comes from server.js

            // not to be transmitted
            requirements: {},
            events: {},
        };

        // load packs
        state.packNames = packNames;
        var orderedPacks = [];
        for (var i in packNames) {
            var pack = packs[packNames[i]];
            pack.name = packNames[i];
            orderedPacks.push(pack);
        }

        scriptCard.loadPacksIntoState(state, orderedPacks);

        // for (var i in packNames) {
        //     var packName = packNames[i];
        //     if (!packName in packs) {
        //         console.warn('unknown packName: ' + packName);
        //     }
        //     // console.log('loading state: ' + packName + ' - ' + packs[packName])
        //     scriptCard.loadPackIntoState(
        //         state,
        //         packs[packName],
        //         packName
        //     );
        // }

        // allow packs to setup the state
        var setupEvent = scriptCard.makeEvent(state, 'base.setup');
        scriptCard.applyEvent(state, setupEvent);

        return state;
    }


    // makes a game state, which is shared with another player
    var exisitingState = null;
    function matchMake(packNames) {
        if (exisitingState) {
            var ret = { state: exisitingState, playerIndex: 1};
            exisitingState = null;
            return ret;
        }
        else {
            // console.log('packs: ' +JSON.stringify(packs));
            printPacks();
            exisitingState = makeState();
            return { state: exisitingState, playerIndex: 0};
        }
    }

    io.sockets.on('connection', function (socket) {
        // maybe let the client decide on the packs
        var match = matchMake(packNames);
        var state = match.state;
        var playerIndex = match.playerIndex;
        var player = state.players[playerIndex]


        socket.join(match.machID); // so we can talk to our partners

        socket.emit('initialState', {state: state, playerIndex: playerIndex});

        socket.on('test', function(data) {
            console.log('aaaa: ' + JSON.stringify(data));
            data = jsonStringify.toObject(data);
            data.b.push(3);
            console.log('aaaa: ' + JSON.stringify(data));
        });

        socket.on('action', function (event) {
            function error(errorMessage) {
                socket.emit('actionError', {errorMessage: errorMessage});
                console.log('actionError: ' + errorMessage);
            }

            if (!state.playing) {
                error('actions are only valid when state.playing==true');
                return;
            }

            if (!event.name)    {
                error('no event name');
                return;
            }

            event.player = player;
            event.playerIndex = playerIndex;

            var requirement = state.requirements[event.name];
            if (!requirement) {
                error('no requirement found for: ' + event.name);
                return;
            }

            // relay to opponent(s)
            socket.broadcast.to(match.machID).emit('action', event);

            // check that the event meets the requrement
            // we do this after relaying as the requirement function has the potential to change the state
            if (!requirement(state, event)) {
                error('event did not meet requirements: ' + JSON.stringify(event));
                return;
            }


            scriptCard.applyEvent(state, event);    // change the state
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

            console.log('player ready: ' + player.name)
            if (!allReady) return;
            console.log('both ready')

            // start the game
            function emitAndApplyEvent(state, eventName) {
                var event = { name: eventName };
                io.sockets.in(match.machID).emit('event', event);
                scriptCard.applyEvent(state, scriptCard.copyEvent(state, event));
            }

            emitAndApplyEvent(state, 'base.gameStart');
        });
    });
});

console.log('running');
