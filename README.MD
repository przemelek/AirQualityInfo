AirQualityInfo
===================

Electron App which using Airly API will show you Air Quality Index for your area.

Airly works in most of Poland, but only in Poland ;-)

*How it obtains your location?*
----
By little hacking, if it is not able to find location.dat file with your location, it will start server on port 8000, and will open URL https://rmk-hrd.appspot.com/file/geoHelper.html,
this side will try to obtain your geo location (Chrome or other browser will ask you for permission), and when it will get it, it will redirect to localhost:8000 with your location.
Then sever will save location.dat file, and will close itself.

*How to start play with it?*
Clone repo, next do:
npm install --save-dev electron

now you can start app by:
npm start

You will need also Airly apikey, you may obtain it on https://developer.airly.eu/, after this modify main.js file.
