# WU LPIS Registration Bot

Grease/Tamper Monkey Script to automatically register for courses in the WU LPIS

## ✅ How to install
1. Install either the [TamperMonkey](https://www.tampermonkey.net/) or
   [GreaseMonkey](https://www.greasespot.net/) extension for your browser.
1. Click on the extension icon.
1. Create a new user script.
1. Copy or download the entirety of the script from
   [here](https://raw.githubusercontent.com/PreyMa/WU-LPIS-bot/master/wubot.js).
1. Paste the script into text field of your new userscript. (Remove any example code
  that was previously there!)
1. Save and you are done.

If you want to update your version of the script to the most current one, you can
either completely delete the user script and then repeat the steps above like on
first installation. Alternatively, you can edit the userscript by overriding its contents
with the new one.

Be aware, that after updating the script your configuration such as reload time 
and latency correction might be lost.

## ⚡ How to use
1. Enable the script
1. Go to the course's registration page
1. The UI of the bot should appear on top of the table of courses
1. Click `Select course`
1. Select the course in the table by clicking on it
1. Now the course id and registration time should appear in the table of scheduled 
   registrations (If not you can always manually enter the data)
2. Click `Go!` to start the registration
3. The bot then automatically opens a browser tab for each scheduled registration
4. When the clock reaches `00:00:00` the tabs will automatically reload the page
   repeatedly until it can click the `anmelden` button
5. The color of the button should change to yellow and the page reloads another time.
6. When the registration was successful you should see a message shown by the bot.

You can reload the page or close and reopen the browser tab, the bot will store
your settings. But the page has to be open (and the bot active) during the registration!
The bot also only opens the registration tabs once when you click 'Go!'. If you
were to accidentally close a tab (a `❌` will appear in the `Bot tabs` column)
simply click `Stop` and then `Go!` again to restart the system.

> **Warning**
> The bot only reloads the page and clicks the `anmelden` button. You have to
> configure and start the bot yourself, plus keep the tab open!
> Do not close your laptop or let your computer go to sleep!
>
> Some browsers will suspend tabs in the background after a few minutes (Chrome ~5
> minutes). Therefore, you should start (`Go!`) the bot only shortly before
> the registration begins, for example 2 minutes.

## 🤔 How does it work
The script reads the source code of the LPIS page and allows you to select a course
to register for. Each scheduled course registration is added to the table shown in
the UI of the bot. By clicking the `Go!` button the bot automatically opens as many 
browser tabs as there are scheduled registrations. The main browser tab communicates
with the other ones, which each start a timer. When the timer finishes the page is
reloaded and the script clicks the `anmelden` button as fast as possible. If a tab
is able to complete the registration or encounters an error it sends a message back
to the main tab.

The bot/script only runs on your computer inside your browser.
There is no communication with other servers involved other than LPIS and none of
your Information leaves your browser. The whole system is intended to emulate
a user with superhuman reflexes and mouse clicking speed, somewhat like a "fancy"
autoclicker. However, it does not take control of your input devices such as your
mouse or keyboard to simulate a use, instead the bot interacts with the browser's
internal representation of the website (called the DOM) directly.

## 👎 What it does not do
The bot does not...

* ... automatically start your browser, or does anything outside of LPIS.
* ... interact with other open tabs in your browser except LPIS.
* ... start your computer or wake it from sleep.
* ... use the LPIS API or any endpoints, it simply interacts with the user-interface
  like a regular user would.
* ... detect changed registration times. If you notice that the time for registration
  changed, you have to re-select the course. Check the clock that the remaining time
  matches your expectation!
* ... take control of your input devices, like automatically moving the mouse.

## ⏳ Correcting for bad latency
If you suffer from bad internet latency you can let the script send the request to
reload the page some time early. By default the script prefetches by 60ms. To adjust
this value for your personal internet connection open the advanced settings and
enter a new value in milliseconds.

## 🤝 Contribute
Contributions are always welcomed. Please open an issue or pull-request.

## 📃 License
This project is licensed under the MIT license.
