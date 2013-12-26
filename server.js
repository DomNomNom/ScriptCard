var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
var fs = require('fs');
var util = require('util');

app.listen(9000);

// ====== Include scriptcard.js functions ======

function read(f){return fs.readFileSync(f).toString()};
function include(f){eval.apply(global,[read(f)])};

include('scriptcard.js');

// ====== Include packs ======

var events = {};

var packs = ['consolelog'];
var pack;
for (var i in packs) {
  var packName = packs[i];
  include('packs/'+packName+'.js'); // that file should have a definition for 'pack'
  pack = makePack();

  for (var eventName in pack.events) {
    var globalEventName = packName+'.'+eventName;
    if (globalEventName in events) {
      console.error('duplicate event name: ' + globalEventName);
      continue;
    }
    console.log('found event: ' + globalEventName);
    events[globalEventName] = pack.events[eventName];
  }
}


// ====== Webserver hander ======

// sends a file to the user
function sendFile(res, fileName){
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

// makes a game state, which is shared with another player (socket)
var exisitingState = null;
function matchMake(socket) {
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

  socket.join(match.machID); // so we can talk to our partners

  socket.emit('state', {state: state});
  socket.emit('player', {player: player});
  socket.on('event', function (data) {
    if (!data.name)        { console.error('event without name');       return; }
    if ('function' in data) {
      console.log('event should not have function yet');
      return;
    }

    socket.broadcast.to(match.machID).emit('event', data); // relay to opponent(s)
    data.function = events[data.name];
    if (!data.function) {
      console.error('could not find event function for: ' + data.name)
    }

    applyEvent(state, data);
  });
});

console.log('running');
