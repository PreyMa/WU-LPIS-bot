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

  function findLvaRowById( id ) {
    // Skip the <tr> inside the <thead> by starting with index 1
    const rows= mainTable().rows;
    for( let i= 1; i< rows.length; i++ ) {
      const row= rows.item( i );
      if( id === extractLvaIdFromRow( row ) ) {
        return row;
      }
    }

    return null;
  }

  function extractLvaIdFromRow( row ) {
    return row.firstElementChild.innerText.split('\n')[0].trim();
  }

  function extractSubmitButtonFromRow( row ) {
    return row.querySelector('td.action form input[type="submit"]');
  }

  function extractDateFromRow( row ) {
    const text= row.querySelector('td.action').innerText.trim();
    if( !/^\w+\s+\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{1,2}$/gm.test( text ) ) {
      console.error(`Regex check failed`);
      return null;
    }

    const parts= text.split(/\s/);
    if( parts[0] !== 'ab' && parts[0] !== 'bis' ) {
      console.error(`Expected 'ab' or 'bis' before date string`);
      return null;
    }

    if( parts.length < 3 ) {
      console.error('Too little parts to parse date');
      return null;
    }

    const dateParts= parts[1].split('.');
    const timeParts= parts[2].split(':');

    return new Date(
      parseInt( dateParts[2] ), // year
      parseInt( dateParts[1] ) -1, // month (zero based)
      parseInt( dateParts[0] ), // days
      parseInt( timeParts[0] ), // hours
      parseInt( timeParts[1] ), // minutes
      0, // seconds
      0  // millis
    );
  }

  function dateToLocalIsoString( date ) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,-1)
  }

  class Settings {
    constructor() {
      this.stagedRegistration= null;
      this.activeRegistration= null;
      this.latencyAdjustment= 200;
      this.maxRefreshTime= 10;
      this.buttonModeName= ButtonMode.Register.name;
      this.load();
    }

    load() {
      Object.assign( this, GM_getValue('settings', {}) );
    }

    persist() {
      GM_setValue('settings', this);
    }

    setRegistration( state, row, date ) {
      this.stagedRegistration= null;
      this.activeRegistration= null;

      const registration= {
        lvaId: row ? extractLvaIdFromRow( row ) : null,
        date: date ? date.toISOString() : null
      };

      if( registration.lvaId && registration.date ) {
        if( state === State.Ready ) {
          this.stagedRegistration= registration;

        } else if( state === State.Pending ) {
          this.activeRegistration= registration;
        }
      }

      this.persist();
    }

    registration() {
      return this.activeRegistration || this.stagedRegistration;
    }

    toState() {
      if( this.activeRegistration && this.activeRegistration.lvaId && this.activeRegistration.date ) {
        return State.Pending;
      }

      return State.Ready;
    }

    adjustedMillisUntil( date ) {
      return (date.getTime() - settings.latencyAdjustment) - Date.now();
    }

    buttonMode() {
      return ButtonMode[this.buttonModeName];
    }
  }

  class ReloadTimer {
    constructor() {
      this.timer= null;
    }

    set( date ) {
      // Clear old timer first
      if( this.timer ) {
        window.clearTimeout( this.timer );
        this.timer= null;
      }

      if( date ) {
        const millis= settings.adjustedMillisUntil( date );
        if( millis < 0 ) {
          // Stop refreshing after a specified number of seconds
          if( millis < -1000 * settings.maxRefreshTime ) {
            return;
          }

          return this._doRefresh();
        }

        console.log('refresh in', millis, 'ms');
        this.timer= window.setTimeout(() => this._doRefresh(), millis);
      }
    }

    _doRefresh() {
      window.location.reload();
    }
  }

  class UIElement {
    getRoot() {
      return this.root;
    }

    insertBefore( otherElement ) {
      otherElement.parentElement.insertBefore( this.getRoot(), otherElement );
    }
  }

  function createStyledElement( type, style, children= [], attributes= {} ) {
    const element= document.createElement( type );
    Object.assign( element.style, style );
    children.forEach( c => {
      if( typeof c === 'string' ) {
        element.appendChild( document.createTextNode(c) );
        return;
      }

      if( c instanceof UIElement ) {
        element.appendChild( c.getRoot() );
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
    HoveredRow: '#acf1cd',
    ActiveSubmitButton: '#5eff41'
  };

  const State= {
    Ready: {text: 'Ready', color: 'lightgreen'},
    Error: {text: 'Error!', color: Color.ErrorBox},
    Pending: {text: 'Pending...', color: 'yellow'},
    Selecting: {text: 'Selecting...', color: 'grey'}
  }

  const ButtonMode= {
    Register: { name: 'Register', before: 'anmelden', after: 'abmelden' }
  }

  class Clock extends UIElement {
    constructor() {
      super();

      this.signField= createStyledElement('span', {});
      this.hourField= createStyledElement('span', {});
      this.minuteField= createStyledElement('span', {});
      this.secondField= createStyledElement('span', {});

      this.root= createStyledElement('div', {
        fontSize: '2rem',
        fontFamily: 'Consolas,monospace'
      }, [
        createStyledElement('div', {
          whiteSpace: 'pre',
          border: '7px grey double',
          padding: '1rem',
          width: 'max-content'
        }, [
          this.signField,
          this.hourField, ' : ',
          this.minuteField, ' : ',
          this.secondField
        ])
      ]);

      this.targetTime= null;
      this.intervalTimer= window.setInterval( () => this._update(), 500 );
      this._update();
    }

    show( doShow= true ) {
      this.root.style.display= doShow ? 'block' : 'none';
    }

    setTargetTime( date ) {
      this.targetTime= date instanceof Date ? date.getTime() : date;
      this._update();
    }

    stop() {
      window.clearInterval( this.intervalTimer );
      this.intervalTimer= null;
    }

    _update() {
      if( !this.targetTime ) {
        this.signField.innerText= '  ';
        this.hourField.innerText= this.minuteField.innerText= this.secondField.innerText= '--';
        this.secondField.style.color= 'black';
        return;
      }

      const now= Date.now();
      const diff= Math.round( Math.abs(this.targetTime - now) / 1000 );
      this.secondField.innerText= `${diff % 60}`.padStart(2, '0');
      this.minuteField.innerText= `${Math.floor( diff / 60 ) % 60}`.padStart(2, '0');
      this.hourField.innerText= Math.floor( diff / 3600 );

      const isBefore= now < this.targetTime;
      this.signField.innerText= isBefore ? '- ' : '+ ';
      this.secondField.style.color= isBefore && diff <= 10 ? 'red' : 'black';
    }
  }

  class UserInterface extends UIElement {
    constructor() {
      super();

      this.stateField= createStyledElement('div', {});
      this.lvaField= createStyledElement('input', {}, [], {type: 'text', title: 'Course id'});
      this.timeField= createStyledElement('input', {}, [], {type: 'datetime-local', title: 'Registration time'});
      this.selectLvaButton= createStyledElement('button', {}, ['Select Course']);
      this.startStopButton= createStyledElement('button', {}, ['Go!']);
      this.clearErrorButton= createStyledElement('button', {display: 'none', float: 'right'}, ['Close']);

      this.errorField= createStyledElement('div', {
        border: '1px solid grey',
        padding: '1rem',
        fontStyle: 'italic',
        display: 'none'
      }, [
        createStyledElement('span', {}),
        this.clearErrorButton
      ]);

      this.clock= new Clock();

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
        this.clock,
        this.errorField
      ]);

      // TODO: determine intial state
      this.state= null;
      this.lvaRow= null;
      this.submitButton= null;
      this.date= null;

      this._restoreStateFromSettings();
      this._setupLvaSelection();
      this._setupDateSelection();
      this._setupStartStopButton();
      this._setupClearErrorButton();
    }

    _restoreStateFromSettings() {
      const registration= settings.registration();
      if( !registration ) {
        this._setLvaRow( null, true );
        this._setDate( null );
        this._setState( State.Ready );
        return;
      }

      if( registration.lvaId ) {
        const row= findLvaRowById( registration.lvaId );
        if( !row ) {
          this._showError(`Could not find a course with the id '${registration.lvaId}'`);
          this._setState( State.Ready );
          return;
        }

        // Don't try to auto-detect the date
        this._setLvaRow( row, true );
      }

      if( registration.date ) {
        this._setDate( new Date( registration.date ), true );
      }

      this._setState( settings.toState(), true );
    }

    _handlePendingState( restoreState= false ) {
      if( !this.date || !this.lvaRow ) {
        this._showError('Missing course data or registration time data. Cannot register.');
        this._setState( State.Error );
        return;
      }

      // Check if the button in the 'after' state (now registered) exists -> registration was successfull
      if( this._checkSubmitButton( true ) ) {
        this._showMessage( 'Registration successfull. :^)' );
        this._setState( State.Ready );
        return;
      }

      // Time is already past target time -> try to do the registration
      const millis= settings.adjustedMillisUntil( this.date );
      if( millis < 0 ) {
        // It is too late -> do not try to refresh again and bail out to ready state
        if( millis < -1000* settings.maxRefreshTime ) {
          // When restoring the state during a reload (currently trying to reload) -> show error
          if( restoreState ) {
            this._showError( `Could not register over a span of ${settings.maxRefreshTime} seconds. Aborting.` );
            this._setState( State.Error );

          // Otherwise the user clicked the 'Go' button -> only show warning
          } else {
            this._showMessage( `Registration started more than ${settings.maxRefreshTime} seconds ago` );
            this._setState( State.Ready );
          }
          return;
        }

        // Check if the button in the 'before' state (not registered yet) exists -> error out if not
        if( !this._checkSubmitButton( false ) ) {
          this._showError('Wrong registration mode for this submit button.');
          this._setState( State.Error );
          return;
        }

        // Do the registration
        if( !this.submitButton.disabled ) {
          return this.submitButton.click();
        }
      }

      // Time is before target time or no button was found yet
      // Prime the refresh timer
      reloadTimer.set( this.date );
      return;
    }

    _setupLvaSelection() {
      // Setup event handler for the lva id text field
      this.lvaField.addEventListener('keydown', e => {
        if( e.keyCode === 13 ) {
          if( this.state !== State.Ready ) {
            console.error('bad state for selecting', this.state);
            return;
          }

          // Clear error message
          this._showMessage();

          const id= this.lvaField.value.trim();
          if( !id ) {
            this._setLvaRow( null );
            return;
          }

          this._setLvaRow( findLvaRowById( id ) );

          if( !this.lvaRow ) {
            this._showError(`Could not find a course with the id '${id}'`);
          }
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
          return;
        }

        this._setState( State.Selecting );
        this._showMessage('Click on the course you want to register for');
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
            row.style.backgroundColor= null;
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

        this._setDate( new Date( this.timeField.value ) );
      });
    }

    _setupStartStopButton() {
      this.startStopButton.addEventListener('click', () => {
        if( this.state === State.Pending ) {
          this._setState( State.Ready );

        } else if( this.state === State.Ready ) {
          if( !this.date || !this.lvaRow ) {
            this._showError('Missing course or date!')
            return;
          }

          this._setState( State.Pending );
        }

        // Save the state change
        this._updateSettings();
      });
    }

    _setupClearErrorButton() {
      this.clearErrorButton.addEventListener('click', () => {
        this._setState( State.Ready );
        this.clearErrorButton.style.display= 'none';
        this._showMessage();
        this._updateSettings();
      });
    }

    _enableFields( enable ) {
      this.lvaField.disabled= !enable;
      this.timeField.disabled= !enable;
      this.selectLvaButton.disabled= !enable;
      this.startStopButton.disabled= !enable;
    }

    _setState( state, ...args ) {
      this.state= state;
      this.stateField.innerText= state.text;
      this.stateField.style.backgroundColor= state.color;
      this.clock.show( false );
      reloadTimer.set( null );

      switch( this.state ) {
        case State.Pending:
          this._enableFields( false );
          this.clock.show();
          this.startStopButton.disabled= false;
          this.startStopButton.innerText= 'Stop!';
          this._handlePendingState( ...args );
          break;

        case State.Selecting:
          this._enableFields( false );
          this.selectLvaButton.disabled= false;
          this.selectLvaButton.innerText= 'Stop selecting';
          break;

        case State.Error:
          this._enableFields( true );
          this.startStopButton.innerText= 'Go!';
          this.selectLvaButton.innerText= 'Select course';
          this.clearErrorButton.style.display= 'block';
          break;

        case State.Ready:
          this._enableFields( true );
          this.clock.show( !!settings.registration() );
          this.startStopButton.innerText= 'Go!';
          this.selectLvaButton.innerText= 'Select course';
          break;
      }
    }

    _updateSettings() {
      settings.setRegistration( this.state, this.lvaRow, this.date );
    }

    _setDate( date, restoreState= false ) {
      this.date= date;

      if( !restoreState ) {
        this._updateSettings();
      }

      if( !this.date ) {
        this.timeField.value= null;
        this.clock.show( false );
        return;
      }

      this.timeField.value= dateToLocalIsoString( this.date );
      this.clock.setTargetTime( this.date );
      this.clock.show();
    }

    _checkSubmitButton( useAfterText= false ) {
      if( !this.submitButton ) {
        return false;
      }

      const buttonText= this.submitButton.value || this.submitButton.innerText;
      const expectedText= useAfterText ? settings.buttonMode().after : settings.buttonMode().before;
      return buttonText.trim().toLowerCase() === expectedText;
    }

    _setLvaRow( row, restoreState= false ) {
      if( this.lvaRow ) {
        this.lvaRow.style.backgroundColor= null;
        this.submitButton.style.backgroundColor= null;
      }

      this.lvaRow= row;
      this.lvaField.value= null;

      if( this.lvaRow ) {
        this.lvaField.value= extractLvaIdFromRow( row );

        this.submitButton= extractSubmitButtonFromRow( this.lvaRow );
        if( !this.submitButton ) {
          this._showError('Could not find registration button. This might be a bug');
          this.lvaRow= null;
          return;
        }

        if( !restoreState ) {
          // Be strict about the button type, only when user selects the lva
          if( !this._checkSubmitButton() ) {
            this._showError(
              `Wrong registration mode for this button. ` +
              `Contains '${this.submitButton.value || this.submitButton.innerText}' but expected '${settings.buttonMode().before}'.`
            );
            this.lvaRow= null;
            return;
          }

          const date= extractDateFromRow( this.lvaRow );
          this._setDate( date );
          if( !date ) {
            this._showError( `Could not read date and time for course as it did not conform to 'ab/bis dd.MM.yyyy hh:mm'.` );
          }
        }

        this.submitButton.style.backgroundColor= Color.ActiveSubmitButton;
        this.lvaRow.style.backgroundColor= Color.ActiveRow;
      }

      if( !restoreState ) {
        // Update settings after the date was auto-detected
        this._updateSettings();
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

      this.errorField.firstElementChild.innerText= msg;
      this.errorField.style.display= 'block';
      this.errorField.style.backgroundColor= null;
    }
  }

  /* Main entry point */
  const settings= new Settings();
  const reloadTimer= new ReloadTimer();
  const ui= new UserInterface();
  ui.insertBefore( mainTable() );
})();
