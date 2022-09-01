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

## ⚡ How to use
1. Enable the script
1. Go to the course's registration page
1. The UI of the bot should appear on top of the table of courses
1. Click 'Select course'
1. Select the course in the table by clicking on it
1. Now the course id and registration time should appear in the fields of the bots
   (If not you can always manually enter the data)
1. Click 'Go!' to start the registration
1. When the clock reaches `00:00:00` the bot will automatically reload the page
   repeatedly until it can click the 'anmleden' button
1. The color of the button should change to yellow and the page reloads another time.
1. When the registration was successful you should see a message shown by the bot.

You can reload the page or close and reopen the browser tab, the bot will store
your settings. But the page has to be open (and the bot active) during the registration!

> **Warning**
> The bot only reloads the page and clicks the `anmelden` button. You have to
> navigate to the correct page yourself, and keep the tab open!
> Do not close your laptop or let your computer go to sleep!

## 🤔 How does it work
The script reads the source code of the LPIS page and allows you to select a course,
to register for. A timer is started when a course is selected. When the timer finishes
the page is reloaded and the script clicks the `anmelden` button as fast as possible.

The bot/script only runs on your computer inside your browser.
There is no communication with other servers involved other than LPIS and none of
your Information leaves your browser. The whole system is to intended to emulate
a user with superhuman reflexes and mouse clicking speed, somewhat like a "fancy" autoclicker.

## 👎 What it does not do
The bot does not...

* ... automatically start your browser, or does anything outside of LPIS.
* ... interact with other open tabs in your browser.
* ... start your computer or wake it from sleep.
* ... use the LPIS API or any endpoints, it simply interacts with the user-interface
  like a regular user would.
* ... handle multiple registrations at the same time. There is only one single bot
  instance for all of your open tabs.
* ... detect changed registration times. If you notice that the time for registration
  changed, you have to re-select the course. Check the clock that the remaining time
  matches your expectation!

## ⏳ Correcting for bad latency
If you suffer from bad internet latency you can let the script send the request to
reload the page some time early. By default the script prefetches by 60ms. To adjust
this value for your personal internet connection open the advanced settings and
enter a new value in milliseconds.

## 🤝 Contribute
Contributions are always welcomed. Please open an issue or pull-request.

## 📃 License
This project is licensed under the MIT license.
