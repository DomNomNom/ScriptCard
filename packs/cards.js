
define(['scriptcard.js'], function(scriptCard) {

    function shuffle(array) {
        // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
        var currentIndex = array.length
        var temporaryValue;
        var randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }


    return {
        cards: [],
        events: {
            setup: function (state, event) {
                state.cards = {}; // create a namespace in state
            },
            drawCard: function (state, event) {
                console.log("drawCard!");
                state.player.hand.append(state.player.deck.pop())
            },
            instantiateCard: function (state, event) {
                state.cards.newCard = event.card;
                state.cards.newCard.id = state.cards.nextCardIndex || 0;
                state.cards.nextCardIndex += 1;
            },
            putCardIntoDeck: function (state, event) {
                if (!event.player.deck) {
                    event.player.deck = [];
                }
                event.player.deck.push(event.card);
            },
            submitDeck: function (state, event) {
                var deck = event.deck || [];
                if (!deck.length) {
                    scriptCard.push('cards.deckSubmitted'); // say we are done
                    return;
                }

                // note: reverse order of pushes because we operate on a stack
                scriptCard.push(state, 'cards.deckSubmitted');

                // we are guaranteed to have at least one card in our deck
                for (var i=deck.length-1; i>=0; i--) {
                    var card = deck[i];
                    scriptCard.push(state, { name: 'cards.putCardIntoDeck', card: card, player: player });
                    scriptCard.push(state, { name: 'cards.instantiateCard', card: card } );
                };

            },
            deckSubmitted: function (state, event) { },
        },
        requirements: {
            submitDeck: function (state, event) {
                return (
                    player.deck == undefined &&
                    event.deck instanceof Array
                );
            }

        },
        triggers: {
            'pre': {
                'base.setup': 'cards.setup',
            },
            'post': {
                'turnChange.turnChange' : ['cards.drawCard'],
            },
        }
    };
});
