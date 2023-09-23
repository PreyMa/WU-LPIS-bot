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
// @grant        GM.openInTab
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

  /**
   * @typedef {{name:string, text:string, color:string}} State
   * @type {{Ready:State, Error:State, Pending:State, Starting:State, Selecting:State}}
   */
  const State= {
    Ready: {name: 'Ready', text: '👓 Ready', color: 'lightgreen'},
    Error: {name: 'Error', text: '❌ Error!', color: Color.ErrorBox},
    Pending: {name: 'Pending', text: '⏳ Pending...', color: Color.Pending},
    Starting: {name: 'Starting', text: '🏃‍♂️ Starting...', color: Color.Pending},
    Selecting: {name: 'Selecting', text: '👆 Selecting...', color: Color.HoveredRow}
  }

  /**
   * @typedef {{name:string, text:string, color:string}} ClientStatus
   * @type {{Disconnected:ClientStatus, Error:ClientStatus, Pending:ClientStatus, Done:ClientStatus}}
   */
  const ClientStatus= {
    Disconnected: {name: 'Disconnected', text: '📡 Disconnected', color: 'lightgrey'},
    Error: {name: 'Error', text: '❌ Error!', color: Color.ErrorBox},
    Pending: {name: 'Pending', text: '⏳ Pending...', color: Color.Pending},
    Done: {name: 'Done', text: '👍 Done', color: 'lightgreen'},
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

  /**
   * @typedef {{name:string, prefix:string}} TraceMode
   * @type {{Inbound:TraceMode, Outbound:TraceMode, ResponseIn:TraceMode, ResponseOut:TraceMode}}
   */
  const TraceMode= {
    Inbound: {name: 'Inbound', prefix: '→ Trace'},
    Outbound: {name: 'Outbound', prefix: '← Trace'},
    ResponseIn: {name: 'ResponseIn', prefix: '→ Trace (Response)'},
    ResponseOut: {name: 'ResponseOut', prefix: '← Trace (Response)'}
  }

  const doTracing= false;
  /**
   * Optionally print a trace message for a channel message packet
   * @param {TraceMode} mode 
   * @param {ChannelMessage} packet 
   * @param {string} info 
   */
  function tracePacket(mode, packet, info= '') {
    if( doTracing ) {
      console.log(mode.prefix, info, packet, new Error());
    }
  }

  /**
   * @returns {never}
   */
  function abstractMethod() {
    throw Error('abstract method');
  }

  function assert(cond, msg= 'Assertion failed') {
    if(!cond) {
      throw Error(msg);
    }
  }

  /**
   * Creates a promise that resolves after the specified number of milliseconds
   * @param {number} millis 
   * @returns {Promise<void>}
   */
  async function asyncSleep(millis) {
    return new Promise( resolve => {
      window.setTimeout(() => resolve(), millis);
    });
  }

  /**
   * Returns the anchor element containing 'Einzelanmeldung'
   * @returns {HTMLAnchorElement|null}
   */
  function extractNavbarFirstItem() {
    return document.querySelector('body > a[title="PRF/LVP/PI-Anmeldung"]');
  }

  let mainTableElement= null;
  /**
   * Searches for the main table listing all the LVAs
   * @returns {HTMLTableElement|null}
   */
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

  /**
   * Finds the table row for a LVA by its id shown in the first table cell
   * @param {string} id 
   * @returns {HTMLTableRowElement|null}
   */
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

  /**
   * The id of a LVA by its table row element
   * @param {HTMLTableRowElement} row 
   * @returns {string}
   */
  function extractLvaIdFromRow( row ) {
    return row.firstElementChild.innerText.split('\n')[0].trim();
  }

  /**
   * Searches for a submit element in a LVA table row
   * @param {HTMLTableRowElement} row 
   * @returns {HTMLButtonElement|HTMLAnchorElement|null}
   */
  function extractSubmitButtonFromRow( row ) {
    return row.querySelector('td.action form input[type="submit"]') ||
           row.querySelector('td.action a');
  }

  /**
   * Searches for and parses the registration start date of a LVA by its row
   * @param {HTMLTableRowElement} row 
   * @returns {Date|null}
   */
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

  /**
   * Check if the provided submit (button) element has the expected state
   * @param {Settings} settings 
   * @param {HTMLAnchorElement|HTMLButtonElement} submitButton 
   * @param {boolean} useAfterText 
   * @returns {boolean}
   */
  function checkSubmitButton(settings, submitButton, useAfterText= false) {
    const buttonText= submitButton.value || submitButton.innerText;
    const expectedText= useAfterText ? settings.buttonMode().after : settings.buttonMode().before;
    return buttonText.trim().toLowerCase() === expectedText;
  }

  /**
   * Creates an up-to-date URL to a registration page by its id. The current
   * URL is taken and the SPP query param is modified to create the new URL
   * @param {string|number} pageId 
   * @returns {URL}
   */
  function urlToPageId( pageId ) {
    // LPIS requires the SPP values to be in the same place every time,
    // else the server returns an error page. For more info see 'currentPageId()'
    const url= new URL(window.location);
    url.search= url.search.replace(/SPP=\w+(;?)/, `SPP=${pageId}$1`);
    return url;
  }

  let cachedPageId= null;
  /**
   * Reads and caches the page id of the current page
   * @returns {string|null}
   */
  function currentPageId() {
    if( cachedPageId ) {
      return cachedPageId;
    }

    // LPIS stores its query parameters separated by semicolons instead of
    // ampersand which therefore prevents the use 'url.searchParams'. Instead
    // it is back to custom regex
    const match= window.location.search.match(/SPP=(?<spp>\w+);?/);
    if( !match || !match.groups.spp ) {
      return null;
    }

    return cachedPageId= match.groups.spp;
  }

  /**
   * Creates an HTML element by its node name and sets attributes & style
   * Child elements are automatically added in order
   * @param {string} type 
   * @param {{}} attributes 
   * @param {{}} style 
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLElement}
   */
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

  /**
   * Creates a <div> element with the interface of 'createStyledElement(...)'
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLDivElement}
   */
  function div(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'div', attributes, style, ...children );
  }

  /**
   * Creates a <input> element with the interface of 'createStyledElement(...)'
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLInputElement}
   */
  function input(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'input', attributes, style, ...children );
  }
  
  /**
   * Creates a <button> element with the interface of 'createStyledElement(...)'
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLButtonElement}
   */
  function button(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'button', attributes, style, ...children );
  }
  
  /**
   * Creates a <span> element with the interface of 'createStyledElement(...)'
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLSpanElement}
   */
  function span(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'span', attributes, style, ...children );
  }
  
  /**
   * Creates a <tr> element with the interface of 'createStyledElement(...)'
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLTableRowElement}
   */
  function tr(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'tr', attributes, style, ...children );
  }
  
  /**
   * Creates a <th> element with the interface of 'createStyledElement(...)'
   * @param  {...HTMLElement|UIElement|string} children 
   * @returns {HTMLTableHeaderCellElement}
   */
  function th(attributes= {}, style= {}, ...children) {
    return createStyledElement( 'th', attributes, style, ...children );
  }

  /**
   * Converts a date with any timezone offset to an ISO string with local timezone offset
   * @param {Date} date 
   * @returns {string}
   */
  function dateToLocalIsoString( date ) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,-1)
  }

  /**
   * Converts a string in 'CamelCase' to a string in 'kebab-case'
   * @param {string} str 
   * @returns {string}
   */
  function camelCaseToKebabCase( str ) {
    return str.split('').map(
      (char, idx) => (char === char.toUpperCase() && idx > 0 ? '-' : '')+ char.toLowerCase()
    ).join('');
  }

  let dynamicStyleSheet= null;
  /**
   * Return a dynamic css style sheet. If necessary one is dynamically generated and attached
   * to the document's header
   * @returns {CSSStyleSheet}
   */
  function styleSheet() {
    if( dynamicStyleSheet ) {
      return dynamicStyleSheet;
    }

    const elem= document.createElement('style');
    document.head.appendChild( elem );
    dynamicStyleSheet= elem.sheet;
    return dynamicStyleSheet;
  }

  /**
   * Prints a CSS rule based on a selector name and css property-value-pairs
   * @param {string} selectorName 
   * @param {{}} cssProperties 
   * @returns {string}
   */
  function serializeCSSProperties(selectorName, cssProperties) {
    let text= `  ${selectorName} {\n`;

    for( const propertyKey in cssProperties ) {
      const propertyValue= cssProperties[propertyKey];
      text+= `    ${camelCaseToKebabCase( propertyKey )}: ${propertyValue};\n`;
    }
    return text+ '  }\n';
  }
  
  /**
   * Create and insert a CSS animation keyframes rule into the dynamic style sheet
   * @param {string} name 
   * @param {{}} frames 
   */
  function createAnimationKeyframes( name, frames ) {
    let ruleText= `@keyframes ${name} {\n`;

    for( const progressKey in frames ) {
      const cssProperties= frames[progressKey];
      ruleText+= serializeCSSProperties(progressKey, cssProperties);
    }

    ruleText+= '}';
    styleSheet().insertRule( ruleText );
  }

  /**
   * Insert CSS rules into the dynamic style sheet
   * @param {{}} rules 
   */
  function insertStyleRules( rules ) {
    for( const ruleName in rules ) {
      const cssProperties= rules[ruleName];
      styleSheet().insertRule( serializeCSSProperties(ruleName, cssProperties) );
    }
  }

  /**
   * Checks if two dates are on the same day, ignoring the time of day
   * @param {Date} a 
   * @param {Date} b 
   * @returns {boolean}
   */
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }
  
  /**
   * Nicely formats time and date objects
   * @param {Date} date 
   * @returns {string}
   */
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

  class Session {
    static MessageChannelConfigKey= 'wu-lpis-bot-channel';
    static BotInitMessageKey= 'wu-lpis-bot-init';
    static BotRegistrationConfigKey= 'wu-lpis-bot-config';

    constructor() {
      this.messageChannelConfig= this._tryLoadKey(Session.MessageChannelConfigKey);
      this.botInitMessage= this._tryLoadKey(Session.BotInitMessageKey);
      this.botRegistrationConfig= this._tryLoadKey(Session.BotRegistrationConfigKey);

      if(this.botRegistrationConfig && this.botRegistrationConfig.registrationTime) {
        this.botRegistrationConfig.registrationTime= new Date(this.botRegistrationConfig.registrationTime);
      }
    }

    _tryLoadKey(keyName) {
      try {
        return JSON.parse(sessionStorage.getItem(keyName));
      } catch ( e ) {
        console.error('Could not load data from session storage for key:', keyName, e);
      }
      return null;
    }

    channelConfig() {
      return this.messageChannelConfig;
    }

    saveChannelConfig( data ) {
      this.messageChannelConfig= data;
      sessionStorage.setItem(Session.MessageChannelConfigKey, JSON.stringify(data));
    }

    initMessage() {
      return this.botInitMessage;
    }

    saveInitMessage( data ) {
      this.botInitMessage= data;
      sessionStorage.setItem(Session.BotInitMessageKey, JSON.stringify(data));
    }

    clearInitMessage() {
      this.botInitMessage= null;
      sessionStorage.removeItem(Session.BotInitMessageKey);
    }

    registration() {
      return this.botRegistrationConfig;
    }

    clearRegistration() {
      this.botRegistrationConfig= null;
      sessionStorage.removeItem(Session.BotRegistrationConfigKey);
    }

    saveRegistration( data ) {
      this.botRegistrationConfig= data;
      const serializeData= Object.assign({}, data);
      serializeData.registrationTime= serializeData.registrationTime.toISOString();
      sessionStorage.setItem(Session.BotRegistrationConfigKey, JSON.stringify(serializeData));
    }
  }

  class TimeoutError extends Error {
    constructor() {
      super('Message channel timeout');
    }
  }

  class PendingMessage {
    constructor( resolverFunc, rejectorFunc, timeout, messageUuid, pendingMessagesMap ) {
      this.resolverFunc= resolverFunc;
      this.rejectorFunc= rejectorFunc;
      this.messageUuid= messageUuid;
      this.pendingMessagesMap= pendingMessagesMap;

      this.timeoutHandle= window.setTimeout(() => this.onTimeout(), timeout);
      this.pendingMessagesMap.set(messageUuid, this);
    }

    _delete() {
      this.pendingMessagesMap.delete(this.messageUuid);
    }

    _clearTimeout() {
      window.clearTimeout(this.timeoutHandle);
    }

    onResponse() { abstractMethod(); }
    onTimeout() { abstractMethod(); }
  }

  class PendingSimpleMessage extends PendingMessage {
    static createAndInsert(pendingMessages, messageUuid, resolverFunc, rejectorFunc, timeout) {
      return new PendingSimpleMessage(resolverFunc, rejectorFunc, timeout, messageUuid, pendingMessages);
    }

    onResponse( response ) {
      assert(response.responseUuid === this.messageUuid);
      this._delete();
      this._clearTimeout();
      this.resolverFunc(response);
    }

    onTimeout() {
      this._delete();
      this.rejectorFunc(new TimeoutError());
    }
  }

  class PendingBroadcastMessage extends PendingMessage {
    constructor(resolverFunc, rejectorFunc, timeout, messageUuid, pendingMessages) {
      super(resolverFunc, rejectorFunc, timeout, messageUuid, pendingMessages);
      this.responses= [];
    }

    static createAndInsert(pendingMessages, messageUuid, resolverFunc, rejectorFunc, timeout) {
      return new PendingBroadcastMessage(resolverFunc, rejectorFunc, timeout, messageUuid, pendingMessages);
    }

    onResponse( response ) {
      assert(response.responseUuid === this.messageUuid);
      this.responses.push(response);
    }
    
    onTimeout() {
      this._delete();
      this.resolverFunc(this.responses);
    }
  }
  
  class MessageChannel {
    constructor(channel= null) {

      if( channel instanceof MessageChannel ) {
        this.pendingMessages= channel.pendingMessages;
        this.uuid= channel.uuid;
        this.serverUuid= channel.serverUuid;
        this._attachChannel(channel.channel);
        return;
      }

      /** @type {Map<string, PendingMessage>} */
      this.pendingMessages= new Map();
      this._attachChannel(new BroadcastChannel('wu-lpis-bot'));

      const sessionData= session.channelConfig();

      if( sessionData ) {
        this.uuid= sessionData.uuid;
        this.serverUuid= sessionData.serverUuid;
      } else {
        this.uuid= crypto.randomUUID();
        this.serverUuid= null;
        this._saveSession();
      }
    }

    static async create() {
      const channel= new MessageChannel();
      await channel._detectServer();
      return channel.isServer() ? new ServerChannel( channel ) : new ClientChannel( channel );
    }

    _attachChannel(channel) {
      this.channel= channel;
      this.channel.onmessage= m => this._handleMessage(m);
      this.channel.onmessageerror= e => this._handleMessageError(e);
    }

    _saveSession() {
      session.saveChannelConfig({
        uuid: this.uuid,
        serverUuid: this.serverUuid
      });
    }

    /**
     * Handles an incoming broadcast channel message and checks whether this
     * instance is addressed by the message.
     * @typedef {{messageUuid:string, senderUuid:string, receiverUuid:string, responseUuid:string?, type:string, data:T}} ChannelMessage
     * @template T
     * @param {MessageEvent<ChannelMessage<any>>} m 
     * @returns 
     */
    _handleMessage( m ) {
      if( m.data.receiverUuid === this.uuid || m.data.receiverUuid === 'all' || (m.data.receiverUuid === 'server' && this.isServer())) {
        if( m.data.responseUuid ) {
          tracePacket(TraceMode.ResponseIn, m.data);

          const messageHandle= this.pendingMessages.get(m.data.responseUuid);
          if(!messageHandle) {
            throw new Error('Response to unknown message uuid:', m);
          }
          messageHandle.onResponse(m.data);
          return;
        }
        
        tracePacket(TraceMode.Inbound, m.data);
        this.onMessage(m.data);
      }
    }

    /** @param{ChannelMessage<any>} m */
    onMessage( m ) {
      println('Unhandled incoming message by plain message channel:', m);
    }

    _handleMessageError( e ) {
      console.error('Got message channel error:', e);
    }

    /**
     * Send a message to specific receiver and a timeout for it to respond. The
     * response is returned asynchronously or an exception is thrown
     * @param {string} receiverUuid
     * @param {string} type 
     * @param {any} data 
     * @param {number} timeout 
     * @returns {Promise<ChannelMessage<any>>}
     */
    async _sendMessage(receiverUuid, type, data= {}, timeout= 1000) {
      return new Promise((resolve, reject) => {
        const messageUuid= crypto.randomUUID();
        const packet= {
          messageUuid,
          senderUuid: this.uuid,
          receiverUuid,
          type,
          data
        };

        this.channel.postMessage(packet);
        tracePacket(TraceMode.Outbound, packet, 'Message');

        PendingSimpleMessage.createAndInsert(this.pendingMessages, messageUuid, resolve, reject, timeout);
      });
    }

    /**
     * Send a broadcast message to all clients. All responses are collected over 
     * the span of the timeout and returned asynchronously as an array.
     * @param {string} type 
     * @param {any} data 
     * @param {number} timeout 
     * @returns {[Promise<ChannelMessage<any>>]}
     */
    async _sendBroadcast(type, data= {}, timeout= 1000) {
      return new Promise((resolve, reject) => {
        const messageUuid= crypto.randomUUID();
        const packet= {
          messageUuid,
          senderUuid: this.uuid,
          receiverUuid: 'all',
          type,
          data
        };

        this.channel.postMessage(packet);
        tracePacket(TraceMode.Outbound, packet, 'Broadcast');

        PendingBroadcastMessage.createAndInsert(this.pendingMessages, messageUuid, resolve, reject, timeout);
      });
    }

    /**
     * Send a message responding to a received one. This is obligatory
     * for any message received, else the other client experiences a
     * timeout error.
     * @param {ChannelMessage<any>} message 
     * @param {string} type 
     * @param {any} data 
     */
    _respond(message, type, data= {}) {
      const packet= {
        messageUuid: crypto.randomUUID(),
        senderUuid: this.uuid,
        receiverUuid: message.senderUuid,
        responseUuid: message.messageUuid,
        type,
        data
      };

      this.channel.postMessage(packet);
      tracePacket(TraceMode.ResponseOut, packet);
    }

    /**
     * This method needs to be called once right after creating the message
     * channel instance to detect which client is currently the server on
     * the shared broadcast channel. In case no server can be found, the
     * client assumes the roll itself.
     */
    async _detectServer() {
      try {
        // This is the fast path so it can be determined immediately whether
        // this is a client instance by finding a different server. In case 
        // of an active registration sequence it is important to not introduce
        // any unnecessary delays to client bots. It however does not really 
        // matter for the server instance, so a more involved process follows
        // if no other server could be found right now.

        const response= await this._sendMessage('server', 'findServer');
        this.serverUuid= response.senderUuid;
      } catch( e ) {

        if( !(e instanceof TimeoutError) ) {
          console.error('Error while finding server (gate 1):', e);
        }

        // No server was found, this means this could be the server instance
        // In case all tabs reload, all instances might end up here. Therefore,
        // a random delay is added so one instance can come out on top. Only
        // minimal timeout is given, so the chance of two waiting timeout
        // windows overlapping is minimized which ultimately results in two
        // instances both becoming server.

        const sleepTime= 5+ Math.floor(500* Math.random());
        println(`Passed the first server detection gate (sleeping for ${sleepTime}ms)`);
        await asyncSleep(sleepTime);

        try {
          const response= await this._sendMessage('server', 'findServer', {}, 5);
          this.serverUuid= response.senderUuid; // This is just a client

        } catch( e ) {
          if( !(e instanceof TimeoutError) ) {
            console.error('Error while finding server (gate 2):', e);
          }

          // This now the server
          this.serverUuid= this.uuid;
        }
      }
      this._saveSession();
    }

    isServer() {
      return this.uuid=== this.serverUuid;
    }
  }

  class ServerChannel extends MessageChannel {
    constructor(channel) {
      super(channel);

      /** @type {function(ChannelMessage<BotClientStatus>):void | null} */
      this.onStatusMessage= null;

      /** @type {function(ChannelMessage<{}>):void | null} */
      this.onHeartbeat= null;
    }

    /** @param{ChannelMessage<any>} message */
    onMessage(message) {
      switch(message.type) {
        case 'findServer':
          this._respond(message, 'ok');
          break;
        case 'unknown':
          break;
        case 'status':
          if( this.onStatusMessage ) {
            this.onStatusMessage( message );
          }
          this._respond(message, 'ok');
        case 'heartbeat':
          if( this.onHeartbeat ) {
            this.onHeartbeat( message );
          }
          this._respond(message, 'ok');
          break;
        default:
          this._respond(message, 'unknown');
          break;
      }
    }

    /**
     * Sends a broadcast message to find all active clients, which
     * are returned as a map with their client id as the key.
     * @returns {Promise<Map<string, RemoteClient>>}
     */
    async findClients() {
      const responses= await this._sendBroadcast('findClient');

      // Create client objects and deduplicate them in one go
      const clients= new Map();
      responses.forEach( resp => {
        if( resp.type === 'ok' ) {
          clients.set(resp.senderUuid, new RemoteClient(
            resp.senderUuid, resp.data.lvaId, new Date(resp.data.registrationTime)
          ));
        }
      });

      return clients;
    }

    /**
     * Send configuration data to each client to initialize their pending
     * state. Each client is sent data needed to register for a LVA.
     * @param {Map<string,RemoteClient>} clientMap 
     * @param {Map<string,Registration>} registrationMap 
     * @param {number} maxRefreshTime 
     */
    async initClients(clientMap, registrationMap) {
      assert(registrationMap.size <= clientMap.size);

      const clients= clientMap.values();
      const responsePromises= [];
      registrationMap.forEach( registration => {
        const client= clients.next();
        if( !client.done ) {
          const initData= Object.assign({}, registration);
          responsePromises.push( 
            // The client needs to navigate to the LVA's registration page which might
            // take some time, so bump the timeout
            this._sendMessage(client.value.clientUuid, 'init', initData, 5000)
          );
        }
      });

      const results= await Promise.allSettled(responsePromises);
      results.forEach( result => {
        if( result.status === 'rejected' ) {
          console.error('Could not initialize client', result.reason);
          return;
        }

        const client= clientMap.get(result.value.senderUuid);
        if( client ) {
          client.updateStatus( result.value );
          return;
        }
      });
    }

    /**
     * Send a broadcast message to disable all clients and set them to their
     * 'disconnected' status.
     * @param {Map<string,RemoteClient>} clientMap 
     */
    async disableClients(clientMap) {
      const responses= await this._sendBroadcast('disable');
      
      responses.forEach(response => {
        const client= clientMap.get(response.senderUuid);
        if( client ) {
          client.updateStatus( response );
        }
      })
    }
  }


  class ClientChannel extends MessageChannel {
    constructor(channel) {
      super(channel);
      this.lvaId= null;
      this.registrationTime= null;
      this.userinterface= null;
      this.heartbeatInterval= null;

      const registration= session.registration();
      if( registration ) {
        this.lvaId= registration.lvaId;
        this.registrationTime= registration.registrationTime;
      }
    }

    /** @param {BotDisplay} ui */
    setUserinterface(ui) {
      this.userinterface= ui;

      this._initializeFromSession();
      
      // Send a heartbeat signal every two seconds
      if( !this.heartbeatInterval ) {
        this.heartbeatInterval= window.setInterval(() => this._sendMessage('server', 'heartbeat'), 2000);
      }

      this._sendMessage('server', 'status', this._statusPacket());
    }

    _initializeFromSession() {
      // Setup the registration process in case there is a init message in the session storage
      try {
        const message= session.initMessage();
        if( message ) {
          const {lvaId}= message.data;
          const date= new Date(message.data.date);

          if( !lvaId || !message.data.date || isNaN(date) ) {
            this._respond(message, 'error');
            return;
          }

          // Clear out any active registration
          session.clearRegistration();
          this.userinterface.reset();

          this.lvaId= lvaId;
          this.registrationTime= date;

          // Respond with current status
          const initOk= this.userinterface.initRegistration(lvaId, date);
          this._respond(message, initOk ? 'ok' : 'error', this._statusPacket());
        }
      } catch( e ) {
        //TODO: Error box
        console.error('Could not init registration:', e);
      } finally {
        session.clearInitMessage();
      }
    }

    _clear() {
      this.lvaId= null;
      this.registrationTime= null;

      if( this.userinterface ) {
        this.userinterface.reset();
      }
    }

    /**
     * Create a packet of the current status to be sent as a channel 
     * message's payload
     * @typedef {{status:string, clientUuid:string, lvaId:string, registrationTime:string}} BotClientStatus
     * @returns {BotClientStatus}
     */
    _statusPacket() {
      return {
        status: this.userinterface ? this.userinterface.status.name : ClientStatus.Disconnected.name,
        clientUuid: this.uuid,
        lvaId: this.lvaId,
        registrationTime: this.registrationTime ? this.registrationTime.toISOString() : null
      };
    }

    /** @param{ChannelMessage<any>} message */
    onMessage(message) {
      switch(message.type) {
        case 'findClient':
          this._respond(message, 'ok', this._statusPacket());
          break;
        case 'init':
          // Instead of responding to the message, we store the message and first
          // load the correct page. When the page is loaded and the instance restarts
          // it again becomes a client, checks the session storage for the init
          // message and tries to setup the registration based on the provided
          // configuration. Only then we respond to the message and clear out the
          // session storage.
          println(`Got init message. Page will be reloaded shortly (id ${message.data.pageId})...`);
          session.saveInitMessage(message);
          window.location= urlToPageId(message.data.pageId);
          break;
        case 'disable':
          this._clear();
          this._respond(message, 'ok', this._statusPacket());
          break;
        case 'unknown':
          break;
        default:
          this._respond(message, 'unknown');
          break;
      }
    }
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

    /**
     * @param {State} state 
     */
    setState( state ) {
      this.stateName= state.name;
      this.persist();
    }

    /**
     * @returns {State}
     */
    state() {
      return State[this.stateName];
    }

    _filterThisPagesRegistration() {
      this.registrations= this.registrations.filter(r => r.pageId !== currentPageId());
    }

    /**
     * @param {HTMLTableRowElement} row 
     * @param {Date} date 
     */
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

    /**
     * @param {string?} lvaId 
     */
    removeRegistration( lvaId= null ) {
      if( lvaId ) {
        this.registrations= this.registrations.filter(r => r.lvaId !== lvaId);
      } else {
        this._filterThisPagesRegistration();
      }
      this.persist();
    }

    /**
     * @typedef {{pageId:string, lvaId:string, date:string}} Registration
     * @returns {Map<string,Registration>}
     */
    registrationsMap() {
      const map= new Map();
      this.registrations.forEach( r => map.set(r.pageId, Object.assign({}, r)) );
      return map;
    }

    /**
     * @param {Date} date 
     * @returns {number}
     */
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

        println('Refresh page in', millis, 'ms');
        this.timer= window.setTimeout(() => this._doRefresh(), millis);
      }
    }

    _doRefresh() {
      window.location.reload();
    }
  }

  class UIElement {
    constructor() {
      /** @type {Map<string,Set<function(Event)>>} */
      this._eventListeners= new Map();
    }

    /**
     * @returns {HTMLElement}
     */
    getRoot() {
      return this.root;
    }

    /**
     * @param {Node} otherElement 
     */
    insertBefore( otherElement ) {
      otherElement.parentElement.insertBefore( this.getRoot(), otherElement );
    }

    /**
     * @param {string} type 
     * @param {function(Event)} func 
     */
    addEventListener(type, func) {
      let listeners= this._eventListeners.get(type);
      if( !listeners ) {
        this._eventListeners.set(type, listeners= new Set());
      }
      listeners.add(func);
    }

    /**
     * @param {Event} ev 
     */
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
    /**
     * @param {ServerChannel} messageChannel 
     */
    constructor(messageChannel) {
      super();

      createAnimationKeyframes('wu-bot-moving-gradient', {
        from: { backgroundPosition: 'left bottom' },
        to: { backgroundPosition: 'right bottom' }
      });

      insertStyleRules(Style.Table);

      this.root= div({}, Style.mainContainer,
        div({}, Style.topBar,
          this.stateField= div({title: 'Current state'}, {padding: '5px', borderRadius: '5px'}),
          this.lvaField= input({type: 'text', title: 'Course id'}),
          this.timeField= input({type: 'datetime-local', title: 'Registration time'}),
          this.advancedSettingsButton= button({title: 'Show advanced settings'}, {}, 'Advanced'),
          this.selectLvaButton= button({title: 'Select a course'}, {}, 'Select Course'),
          this.startStopButton= button({title: 'Arm the bot'}, {}, 'Go!')
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
      this.messageChannel= messageChannel;
      this.clients= null;

      document.title= '🏠 '+ document.title;

      this._restoreStateFromSettings();
      this._setupLvaSelection();
      this._setupDateSelection();
      this._setupStartStopButton();
      this._setupClearErrorButton();
      this._setupAdvancedSettings();
      this._setupRegistrationTable();
      this._setupTimedWarnings();
      this._setupMessageChannelEvents();
      this._setupClientHeartbeatCheck();
    }

    _restoreStateFromSettings() {
      this.latencyAdjustmentField.value= settings.latencyAdjustment;
      this.maxRefreshTimeField.value= settings.maxRefreshTime;
      this.buttonModeField.value= settings.buttonMode().name;
      this.registrationMap= settings.registrationsMap();

      // The starting state cannot be restored
      if( settings.state() === State.Starting ) {
        settings.setState(State.Ready);
      }

      const registration= this.registrationMap.get(currentPageId());
      if( !registration ) {
        this._setLvaRow( null, true );
        this._setDate( null );
        this._setState( settings.state(), true );
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
    
    _handlePendingState( restoreState= false ) {
      if( !this.registrationMap.size ) {
        this._showError('Missing course data or registration time data. Cannot register.');
        this._setState( State.Error );
        return;
      }

      const time= this._findClosestRegistrationTime();
      this.clock.setTargetTime(time);

      // Check if its too late
      const millis= settings.adjustedMillisUntil( time );
      if( millis < -1000* settings.maxRefreshTime ) {
        // Cannot switch to Pending when too late
        if( !restoreState ) {
          this._showMessage( `Registration started more than ${settings.maxRefreshTime} seconds ago` );
          this._setState( State.Ready );
        }
        return;
      }

      // Do not prepare clients when switching to Pending state
      if( this.state === State.Starting || restoreState ) {
        this._prepareClients();
      }
    }

    async _prepareClients() {
      // Find all clients and add them to the UI
      this.clients= await this.messageChannel.findClients();
      this._updateRegistrationsTable();

      if( this.state === State.Pending ) {
        return;
      }

      // Open additional clients if we are missing some
      const numClients= this.registrationMap.size;
      for( let i= this.clients.size; i < numClients; i++ ) {
        try {
          GM.openInTab(window.location.toString(), {loadInBackground: true});
        } catch( e ) {
          console.error('Could not open new tabs:', e);
          this._showError('Could not open new tabs.');
          this._setState( State.Error );
          return;
        }
      }

      // Wait for all the clients to appear over a span of 5s
      for( let i= 0; i!== 5; i++ ) {
        await asyncSleep(1000);
        this.clients= await this.messageChannel.findClients();
        this._updateRegistrationsTable();

        if( this.clients.size >= numClients ) {
          break;
        }
      }

      // Schedule all clients
      await this.messageChannel.initClients(this.clients, this.registrationMap);
      this._updateRegistrationsTable();

      settings.setState( State.Pending );
      this._setState( State.Pending );
    }

    async _clearClients() {
      if( !this.clients ) {
        return;
      }

      this.messageChannel.disableClients( this.clients );
      this._updateRegistrationsTable();
    }
    
    _setupLvaSelection() {
      // Setup event handler for the lva id text field
      this.lvaField.addEventListener('keydown', e => {
        if( e.code === 'Enter' ) {
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
          this._clearClients();
          this._setState( State.Ready );

        } else if( this.state === State.Ready ) {
          if( !this.registrationMap.size ) {
            this._showError('No registrations scheduled!')
            return;
          }

          this._setState( State.Starting );
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

    _setupMessageChannelEvents() {
      this.messageChannel.onStatusMessage= message => {
        if( !this.clients ) {
          return;
        }

        const client= this.clients.get(message.senderUuid);
        if( client ) {
          client.updateStatus( message );
        }
      };

      this.messageChannel.onHeartbeat= message => {
        if( !this.clients ) {
          return;
        }

        const client= this.clients.get(message.senderUuid);
        if( client ) {
          client.heartbeat();
        }
      };
    }

    _setupClientHeartbeatCheck() {
      window.setInterval(() => {
        if( !this.clients ) {
          return;
        }

        this.clients.forEach(client => {
          if( !client.hadEventForMillis(4000) ) {
            client.updateStatus( null );
          }
        });
      }, 1000);
    }

    _setupRegistrationTable() {
      while(this.registrationsTable.rows.length > 1) {
        this.registrationsTable.deleteRow(1);
      }

      const numClients= this.clients ? this.clients.size : 0;
      this.registrationsTable.rows[0].cells[2].innerText= `Bot Tabs (${numClients})`;

      this.registrationMap.forEach( registration => {
        const row= this.registrationsTable.insertRow();

        // Cell with the lva id as a link to the page
        row.insertCell().appendChild(
          createStyledElement('a', {href: urlToPageId(registration.pageId).toString(), title: 'Go to course page'}, {},
            `${registration.lvaId}`,
            span({}, {fontSize: '0.6rem'}, '🔗')
          )
        );
        // Cell with registration time
        row.insertCell().innerText= formatTime( new Date(registration.date) );
        
        // Cell with client bots
        const clientCell= row.insertCell();
        if( this.clients ) {
          this.clients.forEach( client => {
            if( client.waitsFor(registration.lvaId) ) {
              clientCell.appendChild(client.getRoot());
            }
          });
        }

        // Cell with a button for removing a LVA
        const removeButton= button({title: 'Remove from schedule'}, {}, 'Remove');
        row.insertCell().appendChild( removeButton );
        removeButton.addEventListener('click', () => this._removeLvaFromTable(registration.lvaId));

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

    _removeLvaFromTable( lvaId ) {
      if( this.state === State.Starting || this.state === State.Pending ) {
        return;
      }

      settings.removeRegistration(lvaId);
      if( this.lvaRow && lvaId === extractLvaIdFromRow(this.lvaRow) ) {
        this._setLvaRow( null, true );
        this._setDate( null );  // This also updates the table
        return;
      }

      this._updateRegistrationsTable();
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

      switch( this.state ) {
        case State.Pending:
        case State.Starting:
          this._enableFields( false );
          this.clock.show();
          this._showMessage();
          this.startStopButton.disabled= this.state === State.Starting;
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
      this.clock.setTargetTime( this._findClosestRegistrationTime() );
      this.clock.show();
    }

    _findClosestRegistrationTime() {
      let targetDate= this.date;
      this.registrationMap.forEach( registration => {
        const registrationDate= new Date(registration.date);
        if( !targetDate || registrationDate.getTime() < targetDate.getTime() ) {
          targetDate= registrationDate;
        }
      });
      return targetDate;
    }

    _checkSubmitButton( useAfterText= false ) {
      if( !this.submitButton ) {
        return false;
      }

      return checkSubmitButton(settings, this.submitButton, useAfterText);
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

  class RemoteClient extends UIElement {
    constructor(uuid, lvaId= null, registrationTime= null) {
      super();
      this.root= div({}, {height: '1rem', width: '1rem'},
        this.statusField= span({}, {})
      );

      this.clientUuid= uuid;
      this.lastEvent= null;

      if( lvaId && registrationTime && !isNaN(registrationTime) ) {
        this.lvaId= lvaId;  
        this.registrationTime= registrationTime;
        this.setStatus(ClientStatus.Pending);
      } else {
        this.lvaId= null;
        this.registrationTime= null;
        this.setStatus(ClientStatus.Disconnected);
      }
    }

    isArmed() {
      return this.registrationTime && this.lvaId;
    }

    waitsFor( lvaId ) {
      return this.isArmed() && this.lvaId === lvaId;
    }

    /** @param {ClientStatus} status */
    setStatus(status) {
      const splitIdx= status.text.indexOf(' ');
      this.statusField.innerText= status.text.substring(0,splitIdx);
      this.statusField.title= status.text.substring(splitIdx);
    }

    /** @param{ChannelMessage<BotClientStatus?>?} message */
    updateStatus( message ) {
      // No message (data) -> Error
      if( !message || !message.data ) {
        this.setStatus( ClientStatus.Error );
        return;
      }

      this.heartbeat();

      // No registration data -> Disconnected
      const {status: statusName, lvaId, registrationTime: registrationTimeString}= message.data;
      const registrationTime= new Date(registrationTimeString);
      if( !lvaId || !registrationTimeString || isNaN(registrationTime)) {
        this.setStatus( ClientStatus.Disconnected );
        return;
      }

      this.lvaId= lvaId;
      this.registrationTime= registrationTime;

      // Message with bad/unexpected response type -> Error
      if( message.type !== 'ok' && message.type !== 'status' ) {
        this.setStatus( ClientStatus.Error );
        return;
      }

      // Show the status the client declares
      this.setStatus( ClientStatus[statusName] );
    }

    heartbeat() {
      this.lastEvent= Date.now();
    }

    hadEventForMillis( time ) {
      return !this.lastEvent || Date.now() <= this.lastEvent+ time;
    }
  }

  class BotDisplay extends UIElement {
    constructor() {
      super();

      this.root= div({}, Style.mainContainer,
        div({}, Style.topBar,
          this.statusField= div({title: 'Current state'}, {padding: '5px', borderRadius: '5px'})
        ),
        div({}, {}, 
          'This browser tab is a remote controlled bot instance. '+
          'Use the main browser tab with the bot user interface (indicated by 🏠) to do your configuration.'
        ),
        this.clock= new Clock()
      );

      this.status= null;
      this.lvaRow= null;
      this.submitButton= null;
      this.reloadTimer= new ReloadTimer();

      this.setStatus( ClientStatus.Disconnected );

      // Try to load a registration configuration from the session storage
      // to restore the previous state before reloading
      const registration= session.registration();
      if( registration ) {
        this._handlePendingState( registration.lvaId, registration.registrationTime );
      }
    }

    _handlePendingState(lvaId, registrationTime) {
      this.lvaRow= findLvaRowById( lvaId );
      if( !this.lvaRow ) {
        //this._showError(`Could not find a course with the id '${registration.lvaId}'`);
        console.error('find row');
        return false;
      }

      this.submitButton= extractSubmitButtonFromRow( this.lvaRow );
      if( !this.submitButton ) {
        //this._showError('Could not find registration button. This might be a bug');
        console.error('extract submit button')
        return false;
      }

      this.submitButton.style.backgroundColor= Color.ActiveSubmitButton;
      this.lvaRow.style.backgroundColor= Color.ActiveRow;

      this.clock.setTargetTime(registrationTime);

      // Check if the button in the 'after' state (now registered) exists -> registration was successful
      if( this._checkSubmitButton( true ) ) {
        //this._showMessage( 'Registration successful. :^)' );
        println('Registration done');
        this.setStatus( ClientStatus.Done );
        return true;
      }

      // Check if the button in the 'before' state (not registered yet) exists -> error out if not
      if( !this._checkSubmitButton( false ) ) {
        //this._showError('Wrong registration mode for this submit button.');
        console.error('check button')
        this.setStatus( ClientStatus.Error );
        return false;
      }

      // Time is already past target time -> try to do the registration
      const millis= settings.adjustedMillisUntil( registrationTime );
      if( millis < 0 ) {
        // It is too late -> do not try to refresh again and bail out to ready state
        if( millis < -1000* settings.maxRefreshTime ) {
          //this._showError( `Could not register over a span of ${settings.maxRefreshTime} seconds. Aborting.` );
          console.error('too late');
          this.setStatus( ClientStatus.Error );
          return false;
        }

        // Do the registration
        if( !this.submitButton.disabled ) {
          this.submitButton.style.backgroundColor= Color.Pending;
          this.submitButton.click();
          this.setStatus( ClientStatus.Pending );
          return true;
        }
      }

      // Prime the timer to refresh the page in the future
      // This might refresh the page immediately, but that is fine as
      // we already bailed if we are passed max refresh time
      this.reloadTimer.set( registrationTime );

      this.setStatus( ClientStatus.Pending );
      return true;
    }

    _checkSubmitButton( useAfterText= false ) {
      if( !this.submitButton ) {
        return false;
      }

      return checkSubmitButton(settings, this.submitButton, useAfterText);
    }

    initRegistration(lvaId, registrationTime) {
      session.saveRegistration({
        lvaId,
        registrationTime
      });

      return this._handlePendingState(lvaId, registrationTime);
    }

    reset() {
      println('Resetting');
      if( this.lvaRow && this.submitButton ) {
        this.submitButton.style.backgroundColor= null;
        this.lvaRow.style.backgroundColor= null;
      }

      this.setStatus( ClientStatus.Disconnected );
    }

    /** @param {ClientStatus} status */
    setStatus( status ) {
      this.status= status;
      this.statusField.innerText= status.text;
      this.statusField.style.backgroundColor= status.color;

      // Show a red X if there is an error
      const titleSymbol= this.status === ClientStatus.Error ? '❌' : '🛠️';
      document.title= titleSymbol+ ' '+ document.title.substring(document.title.indexOf('L'));
    }
  }

  /* Main entry point */

  // Check if this is the correct page
  if( !mainTable() || !extractNavbarFirstItem() || !extractNavbarFirstItem().classList.contains('thd') || !currentPageId() ) {
    println('off');
    return;
  }

  println('on');

  // Create message channel to detect whether this instance is a client or the server
  const session= new Session();
  const messageChannel= await MessageChannel.create();
  println('I am', messageChannel.isServer() ? 'the server' : 'a client');
  
  // Server mode
  const settings= await Settings.create();
  if( messageChannel.isServer() ) {
    const ui= new UserInterface( messageChannel );
    ui.insertBefore( mainTable() );

  // Client mode
  } else {
    const ui= new BotDisplay();
    ui.insertBefore( mainTable() );
    messageChannel.setUserinterface( ui );
  }
})();
