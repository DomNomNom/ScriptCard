
// we assume this script is loaded by requirejs on index.html
var socket = io.connect();

$(document).ready(function () {
  console.log("hello world!");

  require(['scriptcard.js'], onScriptCard);
})

function onScriptCard(scriptCard) {

  var state = null; // be the same accross all clients and server
  var myIndex = -1; // our index to state.players (varies per-client)
  var me = null;
  var choices = null;
  // var packNames = ['base', 'cards', 'consolelog', 'turnChange'];
  var packs = {};
  var packsLoaded = {};

  // var exports = {};
  function importPack(packName) {
    // $.getScript(
    //   '/packs/' + packName + '.js',  // url
    //   function (data, textStatus, jqxhr) {
    //     // console.log(data ); // Data returned
    //     // console.log(textStatus ); // Success
    //     // console.log(jqxhr.status ); // 200
    //     // console.log("Load was performed." );

    //     // note: we are executing arbitrary code from the server here
    //     // eval.apply(this, [data]);
    //     scriptCard.loadPackIntoState(state, makePack(), packName);
    //     packs[packName] = makePack;
    //     packsLoaded[packName] = true;

    //     var allReady = true;
    //     for (var key in packsLoaded) {
    //       if (!packsLoaded[key]) {
    //         allReady = false;
    //         return;
    //       }
    //     }
    //     if (allReady) {
    //       console.log('player ready!!!!');
    //       socket.emit('playerReady');
    //     }
    //   }
    // );
  }

  socket.on('initialState', function (data) {
    state   = data.state;
    myIndex = data.playerIndex;
    me = state.players[myIndex];

    // load the packs
    // we set packsLoaded[...] = false first as we are doing asynchonous loading
    for (var i in state.packNames) {
      packsLoaded[state.packNames[i]] = false;
    }
    for (var i in state.packNames) {
      importPack(state.packNames[i]);  // asynchronous
    }

    $('#output').text('hello: ' + me.name);
  });



  socket.on('event', function (event) {
    if (!event.name)    {
        error('no event name');
        return;
    }


    var requirement = state.requirements[event.name];
    if (requirement) {
      // check that the event meets the requrement
      // we do this after relaying as the requirement function has the potential to change the state
      if (!requirement(state, event)) {
          error('event did not meet requirements: ' + JSON.stringify(event));
          return;
      }
    }

    // if there's no requirement, we just do what we're told by the server

    applyEvent(state, event);    // change the state

  });

  function error(errorMessage) {
    console.error(errorMessage);
    $('#errorText').text(errorMessage);
  }

  socket.on('actionError', function(data) {
    error(data.errorMessage)
  });

  $('#actionButton').click(function buttonAction() {
    console.log('ending turn');
    var action = { name: 'turnChange.turnChange' }
    socket.emit('action', action);
    scriptCard.applyEvent(state, copyEvent(state, action));
  });

}; // onScriptCard
