#!/usr/bin/env python3

import serveseis
from obspy.clients.fdsn import Client
import obspy


serveSeis = serveseis.ServeSeis()
serveSeis.serveData()

# fake send message manually
# serveSeis.wsServer.send_json_message("howdy there")

client = Client("IRIS")

start = obspy.UTCDateTime('2019-10-31T01:11:19')
end = start + 20*60
quake = client.get_events(starttime=start - 1*60, endtime=start + 20*60, minmagnitude=5)[0]

#iris has crazy event ids


t = obspy.UTCDateTime(start)
st = client.get_waveforms("IU", "SNZO", "00", "BHZ", t, t + 20 * 60)

#st = dragrace.getMseed(start, 300, staList=['FL'])

serveSeis.setStream(st)

threeC = client.get_waveforms("IU", "SNZO", "00", "BH?", t, t + 20 * 60)
serveSeis.setStream(threeC)

inventory = client.get_stations(network="IU", station="SNZO",
                                location="00", channel="BH?",
                                level="channel",
                                starttime=start,
                                endtime=end)

st.attach_response(inventory)
st.remove_sensitivity()
st.detrend()
serveSeis.refreshAll()
threeC += client.get_waveforms("IU", "ANMO", "00", "BHZ", t, t + 20 * 60)
