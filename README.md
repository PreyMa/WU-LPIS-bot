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
1. When the registration was successfull you should see a message shown by the bot.

Do not close your laptop or let your computer go to sleep!

## 🤔 How does it work
The script reads the source code of the LPIS page and allows you to select a course,
to register for. A timer is started when a course is selected. When the timer finishes
the page is reloaded and the script clicks the `anmelden` button as fast as possible.

There is no communication with other servers involved other than LPIS and none of
your Information leaves your browser. The whole system is to intended to emulate
a user with superhuman reflexes and mouse clicking speed, somewhat like a "fancy" autoclicker.

## ⏳ Correcting for bad latency
If you suffer from bad internet latency you can let the script send the request to
reload the page some time early. By default the script prefetches by 60ms. To adjust
this value for your personal internet connection open the advanced settings and
enter a new value in milliseconds.

## 🤝 Contribute
Contributions are always welcomed. Please open an issue or pull-request.

## 📃 License
This project is licensed under the MIT license.
