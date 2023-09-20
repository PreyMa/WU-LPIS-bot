// ==UserScript==
// @name         WU LPIS Registration Bot
// @namespace    https://www.egimoto.com
// @version      0.1
// @description  Register with ease
// @author       PreyMa
// @match        *://*/*
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAASUExURQAAAH9/f9PT0+0cJO/v7////4KSIg8AAACKSURBVCjPhdFRDoAgCABQr4DhAewGjXUANi/QR/e/SoqkVLr40HyDZOhSDSL9cLrvb6BfYDQAAMjIeVNYiAoQbRMAEwJ+bREVlGKDnJuPeYmzEsmwEM7jWRKcBdYMKcEK/R8FQG6JdYURsO0DR9A7Bf9qPXjTeokOQWMO9wD9ZB6fIcvD1VdKA7gAUO5YI8LDmx0AAAAASUVORK5CYII=
// @grant        GM.getValue
// @grant        GM.setValue
// @noframes
// ==/UserScript==

(async function() {
  'use strict';

  const Color= {
    ErrorBox: '#ff6969',
    ErrorBoxBorder: '#ff0000',
    ActiveRow: '#90ee90',
    HoveredRow: '#acf1cd',
    ActiveSubmitButton: '#5eff41',
    Pending: 'yellow'
  };

  const State= {
    Ready: {name: 'Ready', text: '👓 Ready', color: 'lightgreen'},
    Error: {name: 'Error', text: '❌ Error!', color: Color.ErrorBox},
    Pending: {name: 'Pending', text: '⏳ Pending...', color: Color.Pending},
    Selecting: {name: 'Selecting', text: '👆 Selecting...', color: Color.HoveredRow}
  }

  const ButtonMode= {
    Register: { name: 'Register', before: 'anmelden', after: 'abmelden' }
  }

  const Style= {
    Clock: {
      container: {
        fontSize: '2rem',
        fontFamily: 'Consolas, monospace',
        display: 'flex',
        justifyContent: 'center'
      },
      frame: {
        whiteSpace: 'pre',
        border: '7px grey double',
        padding: '1rem',
        width: 'max-content'
      }
    },
    Table: {
      'table.schedule td, table.schedule th': {
        padding: '0.3rem'
      },
      'table.schedule tr': {
        borderBottom: '1px solid grey'
      },
      'table.schedule tr:last-child': {
        borderBottom: 'none'
      }
    },
    mainContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      margin: '1rem',
      padding: '1rem',
      boxShadow: '3px 3px 5px 2px #adadad',
      borderRadius: '0.5rem'
    },
    topBar: {
      display: 'flex',
      flexDirection: 'row',
      gap: '1rem'
    },
    messageField: {
      border: '1px solid grey',
      padding: '1rem',
      fontStyle: 'italic',
      display: 'none',
      borderRadius: '5px',
      animation: 'wu-bot-moving-gradient linear 2s infinite'
    }
  };

  function println( ...args ) {
    console.log( '[WU LPIS Registration Bot]', ...args );
  }

  function extractNavbarFirstItem() {
    return document.querySelector('body > a[title="PRF/LVP/PI-Anmeldung"]');
  }

  let mainTableElement= null;
  function mainTable() {
    if( mainTableElement ) {
      return mainTableElement;
    }

    const tables= document.querySelectorAll('table');
    for( const table of tables ) {
      try {
        const headerColumns= table.tHead.firstElementChild.children;
        if( !headerColumns || headerColumns.length !== 3 ) {
          break;
        }

        const veranstaltungText= headerColumns.item(0).innerText.trim().toLowerCase();
        const plaetzeText= headerColumns.item(1).innerText.trim().toLowerCase();
        if( veranstaltungText !== 'veranstaltung' || plaetzeText !== 'plätze' ) {
          break;
        }

        mainTableElement= table;
        return table;
      } catch( e ) {}
    }

    return null;
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
    return row.querySelector('td.action form input[type="submit"]') ||
           row.querySelector('td.action a');
  }

  function extractDateFromRow( row ) {
    const text= row.querySelector('td.action .timestamp').innerText.trim();
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

  let cachedPageId= null;
  function currentPageId() {
    if( cachedPageId ) {
      return cachedPageId;
    }

    return cachedPageId= new URL(window.location).searchParams.get('SPP');
  }

  function createStyledElement( type, attributes, style, ...children ) {
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

  function div(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'div', attributes, style, ...children );
  }

  function input(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'input', attributes, style, ...children );
  }

  function button(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'button', attributes, style, ...children );
  }

  function span(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'span', attributes, style, ...children );
  }

  function tr(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'tr', attributes, style, ...children );
  }

  function th(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'th', attributes, style, ...children );
  }

  function dateToLocalIsoString( date ) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,-1)
  }

  function camelCaseToKebabCase( str ) {
    return str.split('').map(
      (char, idx) => (char === char.toUpperCase() && idx > 0 ? '-' : '')+ char.toLowerCase()
    ).join('');
  }

  let dynamicStyleSheet= null;
  function styleSheet() {
    if( dynamicStyleSheet ) {
      return dynamicStyleSheet;
    }

    const elem= document.createElement('style');
    document.head.appendChild( elem );
    dynamicStyleSheet= elem.sheet;
    return dynamicStyleSheet;
  }

  function serializeCSSProperties(selectorName, cssProperties) {
    let text= `  ${selectorName} {\n`;

    for( const propertyKey in cssProperties ) {
      const propertyValue= cssProperties[propertyKey];
      text+= `    ${camelCaseToKebabCase( propertyKey )}: ${propertyValue};\n`;
    }
    return text+ '  }\n';
  }
  
  function createAnimationKeyframes( name, frames ) {
    let ruleText= `@keyframes ${name} {\n`;

    for( const progressKey in frames ) {
      const cssProperties= frames[progressKey];
      ruleText+= serializeCSSProperties(progressKey, cssProperties);
    }

    ruleText+= '}';
    styleSheet().insertRule( ruleText );
  }

  function insertStyleRules( rules ) {
    for( const ruleName in rules ) {
      const cssProperties= rules[ruleName];
      styleSheet().insertRule( serializeCSSProperties(ruleName, cssProperties) );
    }
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }
  
  function formatTime( date ) {
    const weekDays= ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months= ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'];
    const oneDayMillis= 24*60*60*1000;
    let day= '';
    const today= new Date();
    if( isSameDay(date, today) ) {
      day= 'Today';
    } else if( isSameDay(date, new Date(today.getTime() - oneDayMillis) ) ) {
      day= 'Yesterday';
    } else if( isSameDay(date, new Date(today.getTime() + oneDayMillis) ) ) {
      day= 'Tomorrow';
    } else {
      let ordinal= 'th';
      const dayNum= date.getDate();
      if(dayNum <= 3 || dayNum >= 21) {
        switch (dayNum % 10) {
          case 1:  ordinal= "st"; break;
          case 2:  ordinal= "nd"; break;
          case 3:  ordinal= "rd"; break;
        }
      }
      day= `${weekDays[date.getDay()]} ${dayNum}${ordinal} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }
  
    return `${day} ${date.getHours()}:${(''+ date.getMinutes()).padStart(2, '0')}`;
  }
  
  class Settings {
    constructor() {
      this.latencyAdjustment= 60;
      this.maxRefreshTime= 10;
      this.buttonModeName= ButtonMode.Register.name;
      this.stateName= State.Ready.name;
      this.registrations= [];
    }

    static async create() {
      const instance= new Settings();
      try {
        await instance.load();
      } catch( e ) {
        console.error('Could not load settings', e);
      }
      return instance;
    }

    async load() {
      Object.assign( this, await GM.getValue('settings', {}) );
    }

    persist() {
      GM.setValue('settings', this).then(() => {}).catch( e => console.error('Could not persist settings', e));
    }

    setState( state ) {
      this.stateName= state.name;
      this.persist();
    }

    state() {
      return State[this.stateName];
    }

    _filterThisPagesRegistration() {
      this.registrations= this.registrations.filter(r => r.pageId !== currentPageId());
    }

    addRegistration( row, date ) {
      // Only allow one registration per page
      this._filterThisPagesRegistration();
      this.registrations.push({
        pageId: currentPageId(),
        lvaId: extractLvaIdFromRow( row ),
        date: date.toISOString()
      });
      this.persist();
    }

    removeRegistration( lvaId= null ) {
      if( lvaId ) {
        this.registrations= this.registrations.filter(r => r.lvaId !== lvaId);
      } else {
        this._filterThisPagesRegistration();
      }
      this.persist();
    }

    registrationsMap() {
      const map= new Map();
      this.registrations.forEach( r => map.set(r.pageId, Object.assign({}, r)) );
      return map;
    }

    adjustedMillisUntil( date ) {
      return (date.getTime() - settings.latencyAdjustment) - Date.now();
    }

    buttonMode() {
      return ButtonMode[this.buttonModeName];
    }
  }

  class UIElement {
    constructor() {
      this._eventListeners= new Map();
    }

    getRoot() {
      return this.root;
    }

    insertBefore( otherElement ) {
      otherElement.parentElement.insertBefore( this.getRoot(), otherElement );
    }

    addEventListener(type, func) {
      let listeners= this._eventListeners.get(type);
      if( !listeners ) {
        this._eventListeners.set(type, listeners= new Set());
      }
      listeners.add(func);
    }

    dispatchEvent( ev ) {
      const listeners= this._eventListeners.get(ev.type);
      if( listeners ) {
        listeners.forEach( func => {
          try {
            func( ev );
          } catch(e) {
            console.error(`Uncaught error in event '${ev.type}':`, e);
          }
        });
      }
    }
  }

  class Clock extends UIElement {
    constructor() {
      super();

      this.root= div({}, Style.Clock.container, 
        div({}, Style.Clock.frame, 
          this.signField= span(),
          this.hourField= span(), ' : ',
          this.minuteField= span(), ' : ',
          this.secondField= span()
        )
      );

      this.targetTime= null;
      this.intervalTimer= window.setInterval( () => this._update(), 500 );
      this._update();
    }

    show( doShow= true ) {
      this.root.style.display= doShow ? 'flex' : 'none';
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
      const absDiff= Math.abs(this.targetTime - now) / 1000;
      const secs= Math.round( absDiff );
      this.secondField.innerText= `${secs % 60}`.padStart(2, '0');
      this.minuteField.innerText= `${Math.floor( secs / 60 ) % 60}`.padStart(2, '0');
      this.hourField.innerText= Math.floor( secs / 3600 );

      const isBefore= now < this.targetTime;
      this.signField.innerText= isBefore ? '- ' : '+ ';
      this.secondField.style.color= isBefore && secs <= 10 ? 'red' : 'black';

      // Time is sampled twice a second (with 500ms), only tick on the second sample
      if( absDiff % 1 > 0.5 ) {
        this.dispatchEvent( new CustomEvent('tick', {
          detail: { isBefore, secs, now }
        }) );
      }
    }
  }

  class UserInterface extends UIElement {
    constructor() {
      super();

      createAnimationKeyframes('wu-bot-moving-gradient', {
        from: { backgroundPosition: 'left bottom' },
        to: { backgroundPosition: 'right bottom' }
      });

      insertStyleRules(Style.Table);

      this.root= div({}, Style.mainContainer,
        div({}, Style.topBar,
          this.stateField= div({}, {padding: '5px', borderRadius: '5px'}),
          this.lvaField= input({type: 'text', title: 'Course id'}),
          this.timeField= input({type: 'datetime-local', title: 'Registration time'}),
          this.advancedSettingsButton= button({}, {}, 'Advanced'),
          this.selectLvaButton= button({}, {}, 'Select Course'),
          this.startStopButton= button({}, {}, 'Go!')
        ),
        this.advancedSettingsPane= div({}, Style.topBar,
          this.maxRefreshTimeField= input({type: 'number', title: 'Number of seconds to attempt registration', min: 1}),
          this.latencyAdjustmentField= input({type: 'number', title: 'Latency adjustment in milliseconds', min: 0, step: 10}),
          this.buttonModeField= createStyledElement('select', {title: 'Operation mode'}),
        ),
        div({}, {},
          this.registrationsTable= createStyledElement('table', {class: 'schedule'}, {borderCollapse: 'collapse'},
            tr({}, {},
              th({}, {}, 'Course id'),
              th({}, {}, 'Time'),
              th({}, {}, 'Bot Tabs')
            )
          )
        ),
        this.clock= new Clock(),
        this.messageField= div({}, Style.messageField,
          span({}, {},
            this.clearErrorButton= button({}, {display: 'none', float: 'right'}, 'Close')
          )
        )
      );

      for( const name in ButtonMode ) {
        this.buttonModeField.appendChild(
          createStyledElement('option', {value: name}, {}, name)
        );
      }

      this.state= null;
      this.lvaRow= null;
      this.submitButton= null;
      this.date= null;
      this.registrationMap= null;

      this._restoreStateFromSettings();
      this._setupLvaSelection();
      this._setupDateSelection();
      this._setupStartStopButton();
      this._setupClearErrorButton();
      this._setupAdvancedSettings();
      this._setupRegistrationTable();
      this._setupTimedWarnings();
    }

    _restoreStateFromSettings() {
      this.latencyAdjustmentField.value= settings.latencyAdjustment;
      this.maxRefreshTimeField.value= settings.maxRefreshTime;
      this.buttonModeField.value= settings.buttonMode().name;
      this.registrationMap= settings.registrationsMap();

      const registration= this.registrationMap.get(currentPageId());
      if( !registration ) {
        this._setLvaRow( null, true );
        this._setDate( null );
        this._setState( State.Ready );
        return;
      }

      if( !registration.lvaId || !registration.date ) {
        this._showError(`Stored registration entry is missing values`);
        this._setState( State.Ready );
        return;
      }

      const row= findLvaRowById( registration.lvaId );
      if( !row ) {
        this._showError(`Could not find a course with the id '${registration.lvaId}'`);
        this._setState( State.Ready );
        return;
      }

      // Don't try to auto-detect the date
      this._setLvaRow( row, true );
      this._setDate( new Date( registration.date ), true );

      this._setState( settings.state(), true );
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
          if( !this.registrationMap.size ) {
            this._showError('No registrations scheduled!')
            return;
          }

          this._setState( State.Pending );
        }

        // Save the state change
        settings.setState(this.state);
      });
    }

    _setupClearErrorButton() {
      this.clearErrorButton.addEventListener('click', () => {
        settings.setState( State.Ready );
        this._setState( State.Ready );
        this.clearErrorButton.style.display= 'none';
        this._showMessage();
      });
    }

    _setupAdvancedSettings() {
      // Toggle the advanced settings pane
      this.advancedSettingsButton.addEventListener('click', () => {
        const settingsShown= this.advancedSettingsPane.style.display === 'flex';
        this.advancedSettingsPane.style.display= settingsShown ? 'none' : 'flex';
      });
      this.advancedSettingsPane.style.display= 'none';

      this.latencyAdjustmentField.addEventListener('input', () => this._updateAdvancedSettings());
      this.maxRefreshTimeField.addEventListener('input', () => this._updateAdvancedSettings());
      this.buttonModeField.addEventListener('input', () => this._updateAdvancedSettings());
    }

    _setupTimedWarnings() {
      this.clock.addEventListener('tick', e => {
        // Only 60 secs left and a course is selected
        if( e.detail.isBefore && e.detail.secs < 60 ) {
          if( this.registrationMap.size && this.state !== State.Pending && !this._currentlyShowsMessage() ) {
            this._showWarning(
              'You have scheduled a registration where registration starts in less than 60 seconds.' +
              "Press 'Go!' to enable automatic registration!"
            );
          }
        }
      });
    }

    _setupRegistrationTable() {
      while(this.registrationsTable.rows.length > 1) {
        this.registrationsTable.deleteRow(1);
      }

      this.registrationMap.forEach( registration => {
        const row= this.registrationsTable.insertRow();

        const url= new URL(window.location);
        url.searchParams.set('SPP', registration.pageId);
        row.insertCell().appendChild(
          createStyledElement('a', {href: url.toString()}, {},
            `${registration.lvaId}`,
            span({}, {fontSize: '0.6rem'}, '🔗')
          )
        );
        row.insertCell().innerText= formatTime( new Date(registration.date) );
        row.insertCell();

        if( registration.pageId === currentPageId() ) {
          row.style.backgroundColor= Color.ActiveRow;
        }
      });

      this.registrationsTable.parentNode.style.display= this.registrationMap.size ? 'flex' : 'none';
    }

    _updateRegistrationsTable() {
      if( this.lvaRow && this.date ) {
        settings.addRegistration(this.lvaRow, this.date);
      } else {
        settings.removeRegistration();
      }

      this.registrationMap= settings.registrationsMap();
      this._setupRegistrationTable();
    }

    _updateAdvancedSettings() {
      settings.latencyAdjustment= Math.max(this.latencyAdjustmentField.value || 0, 0);
      settings.maxRefreshTime= Math.max(this.maxRefreshTimeField.value || 0, 0);
      settings.buttonModeName= this.buttonModeField.value;
      settings.persist();
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
      //TODO reloadTimer.set( null );

      switch( this.state ) {
        case State.Pending:
          this._enableFields( false );
          this.clock.show();
          this._showMessage();
          this.startStopButton.disabled= false;
          this.startStopButton.innerText= 'Stop!';
          //TODO this._handlePendingState( ...args );
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
          this.clock.show( this.registrationMap.has(currentPageId()) );
          this.startStopButton.innerText= 'Go!';
          this.selectLvaButton.innerText= 'Select course';
          break;
      }
    }

    _setDate( date, restoreState= false ) {
      this.date= date;

      if( !restoreState ) {
        this._updateRegistrationsTable();
      }

      if( !this.date ) {
        this.timeField.value= null;
        this.clock.show( false );
        return;
      }

      this.timeField.value= dateToLocalIsoString( this.date );

      // Show the closest time on the clock as the target time
      let targetDate= this.date;
      this.registrationMap.forEach( registration => {
        const registrationDate= new Date(registration.date);
        if( registrationDate.getTime() < targetDate.getTime() ) {
          targetDate= registrationDate;
        }
      });

      this.clock.setTargetTime( targetDate );
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
        this._updateRegistrationsTable();
      }
    }

    _showError( msg= null ) {
      this._showMessage('Error: '+ msg);
      this.messageField.style.borderColor= Color.ErrorBoxBorder;
      this.messageField.style.backgroundColor= Color.ErrorBox;
    }

    _showWarning( msg= null ) {
      this._showMessage('Warning: '+ msg);
      this.messageField.style.background= 'linear-gradient(90deg, transparent 30%, #d9e7007d 80%, transparent 100%)';
      this.messageField.style.backgroundSize= '50% 100%';
    }

    _showMessage( msg= null ) {
      if( !msg ) {
        this.messageField.style.display= 'none';
        return;
      }

      this.messageField.firstElementChild.innerText= msg;
      this.messageField.style.display= 'block';
      this.messageField.style.backgroundColor= null;
      this.messageField.style.borderColor= null;
    }

    _currentlyShowsMessage() {
      return this.messageField.style.display !== 'none';
    }
  }

  class BotDisplay extends UIElement {
    constructor() {
      super();

      this.root= div({}, Style.mainContainer,
        div({}, {}, 
          'This browser tab is a remote controlled bot instance. '+
          'Use the main browser tab with the bot user interface to do your configuration.'
        ),
        this.clock= new Clock()
      )
    }
  }

  /* Main entry point */

  // Check if this is the correct page
  if( !mainTable() || !extractNavbarFirstItem() || !extractNavbarFirstItem().classList.contains('thd') || !currentPageId() ) {
    println('off');
    return;
  }

  println('on');

  const settings= await Settings.create();
  const ui= new UserInterface();
  ui.insertBefore( mainTable() );
    //const reloadTimer= new ReloadTimer();
})();
