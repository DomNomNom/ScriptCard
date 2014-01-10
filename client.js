
// we assume this script is loaded by requirejs on index.html

$(document).ready(function () {
  console.log('hello world!');

  require(['scriptcardclient.js'], onScriptCard);
  // require(['packs/base.js'], onScriptCard);
})

function onScriptCard(scriptCard) {
  console.log('got scriptCard.');

  var state = null; // be the same accross all clients and server
  var myIndex = -1; // our index to state.players (varies per-client)
  var me = null;
  var choices = null;
  // var packNames = ['base', 'cards', 'consolelog', 'turnChange'];
  var packs = {};
  var packsLoaded = {};
  var socket = io.connect();

  // var exports = {};

  socket.on('initialState', function (data) {
    console.log('initialState');
    state   = data.state;
    myIndex = data.playerIndex;
    me = state.players[myIndex];

    // load the packs
    // we set packsLoaded[...] = false first as we are doing asynchonous loading
    var packPaths = $.map(state.packNames, function (packName) {
      return 'packs/'+packName+'.js';
    });
    require(packPaths, function loadPacks() {
      for (var i in arguments) {
        var pack = arguments[i];
        scriptCard.loadPackIntoState(state, pack, state.packNames[i]);
        // console.debug('loaded pack: ' + state.packNames[i]);
      }

      console.log('playerReady');
      socket.emit('playerReady');
    })

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
