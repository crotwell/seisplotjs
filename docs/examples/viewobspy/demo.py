#!/usr/bin/env python3

import serveobspy

serveSeis = serveobspy.ServeObsPy('www')
serveSeis.serveData()

import json5, time, os
if os.path.exists("savedconfig.json5"):
    with open('savedconfig.json5') as json_file:
        serveSeis.displayConfig = json5.load(json_file)

from obspy.clients.fdsn import Client
import obspy

def findStation(trace, inventory):
    for n in inventory:
        if n.code == trace.stats.network:
            for s in n:
                if s.code == trace.stats.station:
                    return s
def rotateGCP(stream, quake, inventory):
    origin = quake.preferred_origin()
    station = findStation(stream[0], inventory)
    if station is None or origin is None:
        print(f"Can't rotate without origna and station, {origin}  {station}")
        return stream
    (dist, az, baz) = obspy.geodetics.base.gps2dist_azimuth(origin.latitude, origin.longitude, station.latitude, station.longitude)
    print(f"rotateGCP {station.code} baz={baz}")
    for t in stream:
        print(f"rotate in {t.stats.channel}")
    zne = stream.rotate('->ZNE', inventory=inventory)
    out = zne.rotate('NE->RT', back_azimuth=baz, inventory=inventory)
    for t in out:
        print(f"rotate out {t.stats.channel}")
    return out



client = Client("IRIS")

start = obspy.UTCDateTime('2019-10-31T01:11:19')
end = start + 20*60

st = client.get_waveforms("IU", "SNZO,ANMO", "00", "BH?", start, start + 20 * 60)
serveSeis.stream=st

usgs = Client("USGS")
quakes = usgs.get_events(starttime=start - 1*60, endtime=start + 20*60, minmagnitude=5)
serveSeis.catalog=quakes
#iris has crazy event ids


inventory = client.get_stations(network="IU", station="SNZO,ANMO",
                                location="00", channel="BH?",
                                level="response",
                                starttime=start,
                                endtime=end)
serveSeis.inventory=inventory

#update display config

serveSeis.requestConfig()
# note that this is asynchronous currently, so you need to
# wait a second for it to arrive...
time.sleep(1)
if serveSeis.displayConfig is not None:
    print(json5.dumps(serveSeis.displayConfig, indent=4))
    serveSeis.displayConfig["display"]["showTitle"] = False
    serveSeis.displayConfig["arrange"]["organize"] = "bystation"
    serveSeis.broadcastConfig()

else:
    input("displayConfig is None, open display and then hit return to request")
    serveSeis.requestConfig()
    time.sleep(1)

if serveSeis.displayConfig is not None:
    # save for later
    with open('savedconfig.json5', 'w') as outfile:
        json5.dump(serveSeis.displayConfig, outfile, indent=4)

    # read back in, automatically broadcast as well
    with open('savedconfig.json5') as json_file:
        serveSeis.displayConfig = json5.load(json_file)


    # save infoTemplate to another file to edit
    with open('infoTemplate.handlebars', 'w') as outfile:
        outfile.write(serveSeis.displayConfig['infoTemplate'])
    # read it back in after editing, must manually broadcast for now
    with open('infoTemplate.handlebars') as infile:
        serveSeis.displayConfig['infoTemplate'] = infile.read()
    serveSeis.broadcastConfig()

else:
    print("display config is still None, skipping...")

rot_snzo = rotateGCP(st, quakes[0], inventory)

#input("return to rotate...")
#serveSeis.stream = rot_snzo


st.attach_response(inventory)
serveSeis.stream=st
input("return to add AMNO")

anmo_st = client.get_waveforms("IU", "ANMO", "00", "BH?", start, start + 20 * 160)
inventory = inventory + client.get_stations(network="IU", station="ANMO",
                                location="00", channel="BH?",
                                level="response",
                                starttime=start,
                                endtime=end)
anmo_st.attach_response(inventory)
rot_anmo = rotateGCP(anmo_st, quakes[0], inventory)
st +=anmo_st
#st += rot_anmo
#st.rotate('->ZNE', inventory=inventory)
#st.rotate('NE->RT', inventory=inventory)
serveSeis.inventory=inventory
serveSeis.stream = st
#serveSeis.refreshAll()


input("return to load more...")
yak_st = client.get_waveforms("IU", "YAK", "00", "BH?", start, start + 20 * 60)
yss_st = client.get_waveforms("IU", "YSS", "00", "BH?", start, start + 20 * 60)
serveSeis.stream = yak_st + yss_st
input("return to load yak inventory")

serveSeis.inventory = client.get_stations(network="IU", station="YAK,YSS",
                                location="00", channel="BH?",
                                level="response",
                                starttime=start,
                                endtime=end)

input("return to quit")
