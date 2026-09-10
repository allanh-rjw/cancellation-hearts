# Post-start browser regression boundary

The real-browser gate must exercise both application initialization and the first transition into an active Cancellation Hearts game. For `legacy` and `parity`, it verifies that Start New Game hides setup, shows the game, initializes eight players, reaches passing or playing state, and produces no uncaught browser exception after the transition. In parity mode the local harness returns an explicit authorization denial for Gateway calls so the app also proves that fail-closed learning-service behavior does not crash gameplay.
