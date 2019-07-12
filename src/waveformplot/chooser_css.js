// @flow

export const chooser_css = `

div.timeRangeChooser div div.hourminpopup {
    z-index: 9999;
    display: block;
    position: relative;
    color: #333;
    background-color: white;
    border: 1px solid #ccc;
    border-bottom-color: #bbb;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
}



.hourminpopup.is-hidden {
    display: none;
}
.hourminpopup.is-bound {
    position: absolute;
    box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
    background-color: white;
}

div.hourminpopup div label {
  display: block;
  float: right;
}
div.hourminpopup div {
    display: block;
    float: right;
    clear: both;
}

div.hourminpopup input {
    width: 150px;
}

div.timeRangeChooser div {
  margin: 2px;
}

input.pikaday {
  width: 70px;
}
input.pikatime {
  width: 50px;
}

`;
