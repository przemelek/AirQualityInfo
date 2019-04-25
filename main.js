const electron = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const Tray = electron.Tray;

const { net } = require('electron');
const path = require('path');
const url = require('url');
const http = require('http');
const fs = require('fs');
const child = require('child_process');

const API_KEY = "<YOUR_AIRLY_API_KEY>";
const AIRLY_LEVELS_TO_IMAGES = {
    "VERY_LOW": "green",
    "LOW": "green",
    "MEDIUM": "orange",
    "HIGH": "red",
    "VERY_HIGH": "red",
    "EXTREME": "red"
};


let tray;
var location = null;
const isDarwin = process.platform=="darwin";
const isLinux = process.platform=="linux";
const isWin = process.platform=="win32";

const locationDataFile = path.join(app.getPath("userData"), "location.dat");
const cityDataFile = path.join(app.getPath("userData"), "city.dat");

function getLocation() {
    var location = null;
    try {
        location = fs.readFileSync(locationDataFile);
    } catch (e) {
        console.log(e);
    }
    return location;
}

function getCity() {
    var c = null;
    try {
      c = fs.readFileSync(cityDataFile);
    } catch (e) {
      console.log(e);
    }
    return c;
}

function getLocationFromUser() {
    var server = http.createServer(function (req, res) {
        var url = req.url;
        if (url.startsWith("/?lat=")) {
            url = url.substring("/?lat=".length);
            console.log(url);
            var elems = url.split("&lon=");
            var lat = elems[0];
            var lon = elems[1];
            console.log(lat + " " + lon);
            location = lat + "," + lon;
            fs.writeFileSync(locationDataFile, "" + location);
            setCity(getAirly);
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('<body><html><script>window.close();</script><H1>You can close this window now :-)</H1></html></body>');
        res.end();
        server.close();
    });
    server.listen(8000);
    console.log("Starting app");
    var cmd = "open";
    if (isLinux) {
      cmd = "xdg-open";
    }
    if (isWin) {
      cmd = "start";
    }
    child.execFile(cmd, ["https://rmk-hrd.appspot.com/file/geoHelper.html"], function (err, data) {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data.toString());
    });
}

function startApp() {
    location = getLocation();

    tray = new Tray(path.join(__dirname, 'ic_launcher.png'));
    const contextMenu = Menu.buildFromTemplate([]);

    tray.setContextMenu(contextMenu);
    tray.setTitle("Waiting...");

    if (location == null) {
        getLocationFromUser();
    } else {
        getAirly();
    }
    if (isDarwin) {
      app.dock.hide();
    }
}

function toMap(ar) {
    var m = {};
    for (var i = 0; i < ar.length; i++) {
        var item = ar[i];
        m[item.name] = item.value;
    }
    return m;
}

function lz(s) {
  s=""+s;
  while (s.length<2) s="0"+s;
  return s;
}

function setCity(callAfter) {
  console.log("Toster");
  var elems = location.toString().split(",");
  console.log("city from "+elems);
  var latitude = elems[0] * 1.0;
  var longitude = elems[1] * 1.0;
  var url = "https://nominatim.openstreetmap.org/reverse?format=json&lat="+latitude+"&lon="+longitude+"&zoom=18&addressdetails=1";
  const request = net.request(url);
  var data = "";
  request.on("response", (response) => {
    response.on("data", (chunk) => {
      data+=chunk;
    });
    response.on("end", () => {
      var resp = JSON.parse(data);
      console.log(resp);
      var address = resp["address"];
      var city = address["city"];
      var staddress = address["road"];
      var stnumber = address["house_number"];
      if (!stnumber) stnumber="";
      var location="";
      if (city!=null) {
        location = city+", "+staddress+" "+stnumber;
      }
      fs.writeFileSync(cityDataFile, "" + location);
    });
    if (callAfter) {
      callAfter();
    }
  });
  request.on("error", (error) => {
    console.log(error);
    if (callAfter) {
      callAfter();
    }
  });
  request.end();
}

function getAirly() {
    var elems = location.toString().split(",");
    var latitude = elems[0] * 1.0;
    var longitude = elems[1] * 1.0;
    const request = net.request({
        method: 'GET',
        protocol: 'https:',
        hostname: 'airapi.airly.eu',
        port: 443,
        path: "/v2/measurements/point?lat=" + latitude + "&lng=" + longitude
    });
    request.setHeader("apikey", API_KEY);
    var data = "";
    request.on('response', (response) => {
        response.on('data', (chunk) => {
            data+= chunk;
        });
        response.on('end', () => {
            var current = JSON.parse(data)["current"];
            var values = toMap(current["values"]);
            var indexes = toMap(current["indexes"]);
            var titleStr = "" + indexes["AIRLY_CAQI"];
            tray.setTitle(titleStr);
            var level = current["indexes"][0]["level"];

            var imgLocation = app.getAppPath() + "/" + AIRLY_LEVELS_TO_IMAGES[level] + ".png";

            tray.setImage(imgLocation);

            var content = [];
            content.push({label: "CAQI: "+indexes["AIRLY_CAQI"]});
            var valuesArray = current["values"];
            for (var i = 0; i < valuesArray.length; i++) {
                var current = valuesArray[i];
                content.push({
                    label: current.name + ": " + current.value
                });
            }
            var date = new Date();
            var time = lz(date.getHours())+":"+lz(date.getMinutes())+":"+lz(date.getSeconds());
            content.push({label: "TIME: "+time});
            var city = getCity();
            console.log("city #"+city+"#"+city.length);
            if (city!=null && city.length>0) {
              content.push({label: "ADDRESS: "+city});
            } else {
              setCity();
            }
            content.push({type: "separator"});
            content.push({
                label: "Update location data", click() {
                    getLocationFromUser();
                }
            });
            content.push({
                label: "Exit", click() {
                    app.quit();
                }
            });

            const contextMenu = Menu.buildFromTemplate(content);

            tray.setContextMenu(contextMenu);
            setTimeout(getAirly, 15 * 60 * 1000);
        });
    });
    request.on("error", (error) => {
      console.log(error);
      // setTimeout(getAirly, 3 * 60 * 1000);
      setTimeout(getAirly, 1000);
    });
    request.end();

}

app.on('ready', startApp);
