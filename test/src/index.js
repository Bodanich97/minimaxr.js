
import $ from "jquery";
import mxGame from "minimaxr";

$(document).ready(function() {
    var selectedSquare = null;
    var game = new mxGame();

    function systemResponse() {
        var bestMove = game.BestMove();
        if (!bestMove)
            alert('You win');
        else {
            game.Position.ExecuteMove(bestMove);
            game.MoveHistory[game.MoveHistory.length] = bestMove;
        }
        game.Turn = -game.Turn;
        //document.getElementById('tblBoard').enabled = true;
        createView();
    }

    function squareClick(sq) {
        console.log('starting squareClick function');
        if ($('#tblBoard').enabled === false) 
            return;
        if (selectedSquare == null) {
            selectedSquare = sq;
        }
        else {
            if (game.TryAcceptMove(selectedSquare, sq)) {
                console.log('move accepted: ' + selectedSquare + ' to ' + sq);
                game.Turn = -game.Turn;
                //document.getElementById('tblBoard').enabled = false;
                setTimeout(function() { systemResponse() }, 100);
            } else {
                alert("Invalid Move");
            }

            selectedSquare = null;
        }
        createView();
    }

    function createView() {
        try {
            //setting turn status
            document.getElementById('imgTurn').src = (game.Turn === 1 ? 'assets/white-pawn.PNG' : 'assets/black-pawn.PNG');

            //creating move history view
            $('#tblMoves').empty();
            //alert(game.MoveHistory.length);
            for (var m = 0; m < game.MoveHistory.length; m += 2) {
                try {
                    var theRow = document.createElement("tr");
                    var theCell1 = document.createElement("td");
                    theCell1.innerHTML = game.MoveHistory[m].toString();
                    theCell1.style.color = "black";
                    theCell1.setAttribute("align", "left");
                    theRow.appendChild(theCell1);

                    if (game.MoveHistory[m + 1]) {
                        var theCell2 = document.createElement("td");
                        theCell2.innerHTML = game.MoveHistory[m + 1].toString();
                        theCell2.setAttribute("align", "right");
                        theCell2.style.color = "white";
                        theRow.appendChild(theCell2);
                    }

                    document.getElementById('tblMoves').appendChild(theRow);
                } catch (err) {
                    alert(err);
                }
            }

            //creating the board
            $('#tblBoard').empty();
            var tbody = document.createElement("tbody");
            var sq = 0;
            for (var row = 0; row < 10; row++) {
                var tr = document.createElement("tr");
                for (var col = 0; col < 10; col++) {
                    var td = document.createElement("td");
                    var validSq = (row % 2 === 0 && col % 2 === 0 || row % 2 === 1 && col % 2 === 1);
                    td.setAttribute("bgColor", validSq ? "#FFFF77" : "#FFCC00");
                    td.style.height = "30px";
                    td.style.width = "30px";
                    td.style.fontSize = "8px";
                    if (validSq) {
                        var sq = row * 10 + col;
                        var man = game.Position.Nodes[sq]; //man is an integer with possible values {0, -1, -x, 1, x}; 0=>no man; 1 & -1 are values given own & opp pawns, and x is the value given to a king, as per the strategy being used
                        if (man !== 0) {
                            var img = document.createElement("img");
                            img.style.height = "20px";
                            img.style.width = "20px";
                            var imgSrc = "";
                            switch (man.toString()) {
                                case "1":
                                    {
                                        imgSrc = "assets/white-pawn.PNG";
                                        break;
                                    }
                                case "10":
                                    {
                                        imgSrc = "assets/white-king.PNG";
                                        break;
                                    }
                                case "-1":
                                    {
                                        imgSrc = "assets/black-pawn.PNG";
                                        break;
                                    }
                                case "-10":
                                    {
                                        imgSrc = "assets/black-king.PNG";
                                        break;
                                    }
                                default:
                                    {
                                        imgSrc = "";
                                        break;
                                    }
                            }
                            img.setAttribute("src", imgSrc);
                            td.className = "clickable";
                            if (sq === selectedSquare || document.getElementById('tblBoard').enabled === false) {
                                td.className += " half_transparent";
                            }
                            td.appendChild(img);
                        }

                        //highlightng the last move
                        if (game.MoveHistory.length > 0) {
                            var mv = game.MoveHistory[game.MoveHistory.length - 1];
                            for (var n = 0; n < mv.length; n += 3) {
                                if (sq === mv[n]) {
                                    td.style.border = "solid thin blue";
                                }
                            }
                        }

                        td.innerHTML += sq;
                        //td.setAttribute("onclick", "square_click(" + sq + ")");

                        $(td).on("click", function() {
                            squareClick(this);
                        }.bind(sq));

                    } else {
                        td.innerHTML = "&nbsp;";
                    }
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            document.getElementById('tblBoard').appendChild(tbody);
        } catch (err) {
            alert(err);
        } finally {

        }
    }

    createView();
});



