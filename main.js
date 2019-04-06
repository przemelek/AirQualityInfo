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

// You need your own Airly apikey, you may generate one here https://developer.airly.eu/
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

const locationDataFile = path.join(app.getPath("userData"), "location.dat");

function getLocation() {
    var location = null;
    try {
        location = fs.readFileSync(locationDataFile);
    } catch (e) {
        console.log(e);
    }
    return location;

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
            getAirly();
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('<body><html><script>window.close();</script><H1>You can close this window now :-)</H1></html></body>');
        res.end();
        server.close();
    });
    server.listen(8000);
    console.log("Starting app");
    child.execFile('open', ["https://rmk-hrd.appspot.com/file/geoHelper.html"], function (err, data) {
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

    if (location == null) {
        getLocationFromUser();
    } else {
        getAirly();
    }
    app.dock.hide();
}

function toMap(ar) {
    var m = {};
    for (var i = 0; i < ar.length; i++) {
        var item = ar[i];
        m[item.name] = item.value;
    }
    return m;
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
            tray.setTitle("" + indexes["AIRLY_CAQI"]);
            var level = current["indexes"][0]["level"];

            var imgLocation = app.getAppPath() + "/" + AIRLY_LEVELS_TO_IMAGES[level] + ".png";

            tray.setImage(imgLocation);

            var content = [];
            var valuesArray = current["values"];
            for (var i = 0; i < valuesArray.length; i++) {
                var current = valuesArray[i];
                content.push({
                    label: current.name + ": " + current.value
                });
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
    request.end()
}

app.on('ready', startApp);