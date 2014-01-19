
// we assume this script is loaded by requirejs on index.html

$(document).ready(function () {
  console.log('hello world!');

  require(['scriptcard.js', 'jsonStringify.js'], onScriptCard);
  // require(['packs/base.js'], onScriptCard);
})

function onScriptCard(scriptCard, jsonStringify) {
  console.log('got scriptCard.');


  var state = null; // be the same accross all clients and server
  var myIndex = -1; // our index to state.players (varies per-client)
  var me = null;
  var choices = null;
  var packs = {};
  var packsLoaded = {};
  var socket = io.connect();


  socket.on('initialState', function (data) {
    var a= { a:[1] };
    a.b = a.a;
    a.b.push(2);
    socket.emit('test', jsonStringify.make(a));

    console.log('initialState');
    state   = data.state;
    myIndex = data.playerIndex;
    me = state.players[myIndex];

    // load the packs
    var packPaths = $.map(state.packNames, function (packName) {
      return 'packs/'+packName+'.js';
    });
    require(packPaths, function loadPacks() {
      var packs = [];
      for (var i in arguments) {
        var pack = arguments[i];
        pack.name = state.packNames[i];
        packs.push(pack);
      }
      scriptCard.loadPacksIntoState(state, packs);
      // for (var i in arguments) {
      //   var pack = arguments[i];
      //   scriptCard.loadPackIntoState(state, pack, state.packNames[i]);
      //   // console.debug('loaded pack: ' + state.packNames[i]);
      // }

      console.log('playerReady');
      socket.emit('playerReady');
    });

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

    scriptCard.applyEvent(state, event);    // change the state

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
    scriptCard.applyEvent(state, scriptCard.copyEvent(state, action));
  });

}; // onScriptCard
