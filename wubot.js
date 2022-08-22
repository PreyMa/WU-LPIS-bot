// ==UserScript==
// @name         WU LPIS Registration Bot
// @namespace    https://www.egimoto.com
// @version      0.1
// @description  Register with ease
// @author       PreyMa
// @match        *://*/*
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAASUExURQAAAH9/f9PT0+0cJO/v7////4KSIg8AAACKSURBVCjPhdFRDoAgCABQr4DhAewGjXUANi/QR/e/SoqkVLr40HyDZOhSDSL9cLrvb6BfYDQAAMjIeVNYiAoQbRMAEwJ+bREVlGKDnJuPeYmzEsmwEM7jWRKcBdYMKcEK/R8FQG6JdYURsO0DR9A7Bf9qPXjTeokOQWMO9wD9ZB6fIcvD1VdKA7gAUO5YI8LDmx0AAAAASUVORK5CYII=
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  let mainTableElement= null;
  function mainTable() {
    if( mainTableElement ) {
      return mainTableElement;
    }

    const tables= document.querySelectorAll('table');
    for( const table of tables ) {
      const rowHeader= table.querySelector('th:nth-child(2)');
      if( rowHeader && rowHeader.innerText.trim().toLowerCase() === 'plätze' ) {
        mainTableElement= table;
        return table;
      }
    }
    throw new Error('Could not find main table');
  }


  function extractLvaIdFromRow( row ) {
    return row.firstElementChild.innerText.split('\n')[0].trim();
  }

  function createStyledElement( type, style, children= [], attributes= {} ) {
    const element= document.createElement( type );
    Object.assign( element.style, style );
    children.forEach( c => {
      if( typeof c === 'string' ) {
        element.appendChild( document.createTextNode(c) );
        return;
      }

      element.appendChild( c );
    });

    for( const attr in attributes ) {
      element.setAttribute( attr, attributes[attr] );
    }

    return element;
  }

  const Color= {
    ErrorBox: '#ff6969',
    ActiveRow: '#90ee90',
    HoveredRow: '#acf1cd'
  };

  const State= {
    Ready: {text: 'Ready', color: 'lightgreen'},
    Error: {text: 'Error!', color: 'red'},
    Pending: {text: 'Pending...', color: 'yellow'},
    Selecting: {text: 'Selecting...', color: 'grey'}
  }

  class UserInterface {
    constructor() {
      this.stateField= createStyledElement('div', {});
      this.lvaField= createStyledElement('input', {}, [], {type: 'text'});
      this.timeField= createStyledElement('input', {}, [], {type: 'datetime-local'});
      this.selectLvaButton= createStyledElement('button', {}, ['Select Course']);
      this.startStopButton= createStyledElement('button', {}, ['Go!']);

      this.errorField= createStyledElement('div', {
        border: '1px solid grey',
        padding: '1rem',
        fontStyle: 'italic',
        display: 'none'
      });

      this.root= createStyledElement('div', {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        margin: '2rem'
      }, [
        createStyledElement('div', {
          display: 'flex',
          flexDirection: 'row',
          gap: '1rem'
        }, [
          this.stateField,
          this.lvaField,
          this.timeField,
          this.selectLvaButton,
          this.startStopButton
        ]),
        this.errorField
      ]);

      // TODO: determine intial state
      this.state= null;
      this.lvaRow= null;
      this.date= null;
      this._setState( State.Ready );
      this._setLvaRow( null );

      this._setupLvaSelection();
      this._setupDateSelection();
    }

    _setupLvaSelection() {
      // Setup event handler for the lva id text field
      this.lvaField.addEventListener('keydown', e => {
        if( e.keyCode === 13 ) {
          if( this.state !== State.Ready ) {
            console.error('bad state for selecting', this.state);
            return;
          }

          this._showMessage();

          const id= this.lvaField.value.trim();
          if( !id ) {
            this._setLvaRow( null );
            return;
          }

          // Skip the <tr> inside the <thead> by starting with index 1
          const rows= mainTable().rows;
          for( let i= 1; i< rows.length; i++ ) {
            const row= rows.item( i );
            if( id === extractLvaIdFromRow( row ) ) {
              this._setLvaRow( row );
              return;
            }
          }

          this._showError(`Could not find a course with the id '${id}'`);
          this._setLvaRow( null );
        }
      });

      // Setup event handler for the lva selection button
      this.selectLvaButton.addEventListener('click', () => {
        if( this.state !== State.Ready && this.state !== State.Selecting ) {
          console.error('bad state for selecting', this.state);
          return;
        }

        if( this.state === State.Selecting ) {
          this._setState( State.Ready )
          this._showMessage();
          this.selectLvaButton.innerText= 'Select Course';
          return;
        }

        this._setState( State.Selecting );
        this._showMessage('Click on the course you want to register for');
        this.selectLvaButton.innerText= 'Stop selecting';
      });

      // Setup event handlers for all table rows
      // Skip the <tr> inside the <thead> by starting with index 1
      const rows= mainTable().rows;
      for( let i= 1; i< rows.length; i++ ) {
        const row= rows.item( i );
        row.addEventListener('mouseenter', () => {
          if( this.state === State.Selecting ) {
            row.style.backgroundColor= Color.HoveredRow;
          }
        });
        row.addEventListener('mouseleave', () => {
          if( this.state === State.Selecting ) {
            row.style.backgroundColor= null;
          }
        });
        row.addEventListener('click', () => {
          if( this.state === State.Selecting ) {
            this.lvaField.value= extractLvaIdFromRow( row );
            row.style.backgroundColor= null;
            this.selectLvaButton.innerText= 'Select Course';
            this._showMessage();
            this._setState( State.Ready );
            this._setLvaRow( row );
          }
        });
      }
    }

    _setupDateSelection() {
      this.timeField.addEventListener('input', () => {
        if( this.state !== State.Ready ) {
          console.error('bad state for setting time', this.state);
          return;
        }

        this.date= new Date( this.timeField.value );
      });
    }

    _enableFields( enable ) {
      this.lvaField.disabled= !enable;
      this.timeField.disabled= !enable;
      this.selectLvaButton.disabled= !enable;
      this.startStopButton.disabled= !enable;
    }

    _setState( state ) {
      this.state= state;
      this.stateField.innerText= state.text;
      this.stateField.style.backgroundColor= state.color;

      switch( this.state ) {
        case State.Pending:
          this._enableFields( false );
          break;

        case State.Selecting:
          this._enableFields( false );
          this.selectLvaButton.disabled= false;
          break;

        case State.Ready:
          this._enableFields( true );
          break;
      }
    }

    _setLvaRow( row ) {
      if( this.lvaRow ) {
        this.lvaRow.style.backgroundColor= null;
      }

      this.lvaRow= row;
      if( this.lvaRow ) {
        this.lvaRow.style.backgroundColor= Color.ActiveRow;
      }
    }

    _showError( msg= null ) {
      this._showMessage('Error: '+ msg);
      this.errorField.style.backgroundColor= Color.ErrorBox;
    }

    _showMessage( msg= null ) {
      if( !msg ) {
        this.errorField.style.display= 'none';
        return;
      }

      this.errorField.innerText= msg;
      this.errorField.style.display= 'block';
      this.errorField.style.backgroundColor= null;
    }

    insertBefore( otherElement ) {
      otherElement.parentElement.insertBefore( this.root, otherElement );
    }
  }

  function main() {

    const ui= new UserInterface();
    ui.insertBefore( mainTable() );
  }

  main();
})();
