
# Earthscope Requires Authentication

On October 1, 2026, Earthscope
[announced](https://groups.google.com/a/earthscope.org/g/data-announcements/c/Qg_x-j-Lmpo)
that they would
> require user authentication for all data and product downloads beginning December 15, 2026".

More information on their authentication system can be found at their
[user account](https://docs.earthscope.org/user-account/?utm_medium=email&utm_source=announce&utm_campaign=general) page.

## How will this affect seisplotjs and any web sites built using it?

If you are not using Earthscope's web services, or only getting station information,
nothing will change. At this point they are only requiring authentication for
seismogram data. This includes via the FDSN DataSelect web service, as well
as other modules that make use of dataselect under the hood,
like FedCatalogQuery and SeismogramLoader.

If you are using seisplotjs to get seismograms from Earthscope's FDSN DataSelect web service (which is the default), requests will fail with an "unauthorized" response once this requirement is enabled on 15 Dec 2026.

## Is there a workaround?

There are a few options, but it is unclear which will both be
technically feasible now and be allowed and supported for the future.
Earthscope is actively exploring possible solutions.
