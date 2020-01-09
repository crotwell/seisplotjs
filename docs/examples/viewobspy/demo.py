#!/usr/bin/env python3

import serveobspy

serveSeis = serveobspy.ServeObsPy('www')
serveSeis.serveData()

from obspy.clients.fdsn import Client
import obspy

client = Client("IRIS")

start = obspy.UTCDateTime('2019-10-31T01:11:19')
end = start + 20*60

st = client.get_waveforms("IU", "SNZO", "00", "BH?", start, start + 20 * 60)
serveSeis.stream=st

quakes = client.get_events(starttime=start - 1*60, endtime=start + 20*60, minmagnitude=5)
serveSeis.quake=quakes[0]
#iris has crazy event ids


inventory = client.get_stations(network="IU", station="SNZO",
                                location="00", channel="BH?",
                                level="response",
                                starttime=start,
                                endtime=end)
serveSeis.inventory=inventory

yak_st = client.get_waveforms("IU", "YAK", "00", "BH?", start, start + 20 * 60)
yss_st = client.get_waveforms("IU", "YSS", "00", "BH?", start, start + 20 * 60)


st.attach_response(inventory)
st.remove_sensitivity()
st.detrend()
serveSeis.stream=st
st += client.get_waveforms("IU", "ANMO", "00", "BHZ", start, start + 20 * 60)
serveSeis.refreshAll()
