# BTP / CF / Cloud Connector configuration snapshot

**Captured:** 2026-06-11T09:35:25.747412Z
**Capture script:** `scripts/dump-btp-cf-cc-snapshot.py`

This file is the disaster-recovery / audit snapshot of the deployed
state. Pair with `PROJECT_DISCUSSION.md` §35 (master reference) for
the procedural runbook that produced this state.

Layout:

1. CF target (org / space)
2. CF services (instances)
3. CF service keys
4. Subaccount-level destinations (3 from §27)
5. Instance-level destinations (per-app)
6. Cloud Connector mappings + resources (§26)
7. Service-instance to app mapping table

## 1. CF target

```
API endpoint:   https://api.cf.us11.hana.ondemand.com
API version:    3.220.0
user:           nnavarro@erp-is.com
org:            ERP Integrated Solutions, LLC   dba ShipERP._btp-cf-8qsdli3e
space:          DEV
```

## 2. CF services (instances)

Output has 192 lines (header + service rows).

```
Getting service instances in org ERP Integrated Solutions, LLC   dba ShipERP._btp-cf-8qsdli3e / space DEV as nnavarro@erp-is.com...

name                                                 offering                  plan          bound apps                     last operation     broker                                                               upgrade available
app-runtime-1779763944                               html5-apps-repo           app-runtime   shiperp-fiori-test-approuter   create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelacefiling-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelacefiling-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelacefilingsls-app-front-service                 html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelacefilingsls-destination-service               destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelacefilingsls-xsuaa-service                     xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelacefiling-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelhd6-app-front-service                          html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelhd6-destination-service                        destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelhd6-xsuaa-service                              xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelpickuprequest-app-front-service                html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelpickuprequest-destination-service              destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelpickuprequestsls-app-front-service             html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelpickuprequestsls-destination-service           destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelpickuprequestsls-xsuaa-service                 xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelpickuprequest-xsuaa-service                    xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelshipmentecc-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelshipmentecc-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelshipmenteccsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelshipmenteccsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelshipmenteccsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelshipmentecc-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelshipmentewm-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelshipmentewm-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelshipmentewmsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
cancelshipmentewmsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
cancelshipmentewmsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
cancelshipmentewm-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
carrierperformancereportecc-app-front-service        html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
carrierperformancereportecc-destination-service      destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
carrierperformancereporteccsls-app-front-service     html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
carrierperformancereporteccsls-destination-service   destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
carrierperformancereporteccsls-xsuaa-service         xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
carrierperformancereportecc-xsuaa-service            xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
carrierperformancereportewm-app-front-service        html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
carrierperformancereportewm-destination-service      destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
carrierperformancereportewmsls-app-front-service     html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
carrierperformancereportewmsls-destination-service   destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
carrierperformancereportewmsls-xsuaa-service         xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
carrierperformancereportewm-xsuaa-service            xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
closedelivery-app-front-service                      html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
closedelivery-destination-service                    destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
closedeliverysls-app-front-service                   html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
closedeliverysls-destination-service                 destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
closedeliverysls-xsuaa-service                       xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
closedelivery-xsuaa-service                          xsuaa                     application   shiperp-fiori-test-approuter   update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
createshipmentecc-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
createshipmentecc-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
createshipmenteccsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
createshipmenteccsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
createshipmenteccsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
createshipmentecc-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
createshipmentewm-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
createshipmentewm-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
createshipmentewmsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
createshipmentewmsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
createshipmentewmsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
createshipmentewm-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
createshipmentv2ewm-app-front-service                html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
createshipmentv2ewm-destination-service              destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
createshipmentv2ewmsls-app-front-service             html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
createshipmentv2ewmsls-destination-service           destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
createshipmentv2ewmsls-xsuaa-service                 xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
createshipmentv2ewm-xsuaa-service                    xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
dispute-app-front-service                            html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
dispute-destination-service                          destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
disputehd6-app-front-service                         html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
disputehd6-destination-service                       destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
disputehd6-xsuaa-service                             xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
disputesls-app-front-service                         html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
disputesls-destination-service                       destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
disputesls-xsuaa-service                             xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
dispute-xsuaa-service                                xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
eodhd6-app-front-service                             html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
eodhd6-destination-service                           destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
eodhd6-xsuaa-service                                 xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
farpthd6-app-front-service                           html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
farpthd6-destination-service                         destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
farpthd6-xsuaa-service                               xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightaudit-app-front-service                       html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightaudit-destination-service                     destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightaudithd6-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightaudithd6-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightaudithd6-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightauditsls-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightauditsls-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightauditsls-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightauditupload-app-front-service                 html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightauditupload-destination-service               destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightaudituploadsls-app-front-service              html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightaudituploadsls-destination-service            destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightaudituploadsls-xsuaa-service                  xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightauditupload-xsuaa-service                     xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightaudit-xsuaa-service                           xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightorderplanning-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightorderplanning-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightorderplanningsls-app-front-service            html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
freightorderplanningsls-destination-service          destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
freightorderplanningsls-xsuaa-service                xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
freightorderplanning-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
ltlplanning-app-front-service                        html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
ltlplanning-destination-service                      destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
ltlplanningsls-app-front-service                     html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
ltlplanningsls-destination-service                   destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
ltlplanningsls-xsuaa-service                         xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
ltlplanning-xsuaa-service                            xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
manualshipmentecc-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
manualshipmentecc-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
manualshipmenteccsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
manualshipmenteccsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
manualshipmenteccsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
manualshipmentecc-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
manualshipmentewm-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
manualshipmentewm-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
manualshipmentewmsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
manualshipmentewmsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
manualshipmentewmsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
manualshipmentewm-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
parceldemohd6-app-front-service                      html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
parceldemohd6-destination-service                    destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
parceldemohd6-xsuaa-service                          xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
parcelhd6-app-front-service                          html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
parcelhd6-destination-service                        destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
parcelhd6-xsuaa-service                              xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
planshipment-app-front-service                       html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
planshipment-destination-service                     destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
planshipmentsls-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
planshipmentsls-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
planshipmentsls-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
planshipment-xsuaa-service                           xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
quickpackecc-app-front-service                       html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
quickpackecc-destination-service                     destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
quickpackeccsls-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
quickpackeccsls-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
quickpackeccsls-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
quickpackecc-xsuaa-service                           xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
quickpackewm-app-front-service                       html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
quickpackewm-destination-service                     destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
quickpackewmsls-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
quickpackewmsls-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
quickpackewmsls-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
quickpackewm-xsuaa-service                           xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
requestforpickup-app-front-service                   html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
requestforpickup-destination-service                 destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
requestforpickupsls-app-front-service                html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
requestforpickupsls-destination-service              destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
requestforpickupsls-xsuaa-service                    xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
requestforpickup-xsuaa-service                       xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
saleorder-app-front-service                          html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
saleorder-destination-service                        destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
saleordersls-app-front-service                       html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
saleordersls-destination-service                     destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
saleordersls-xsuaa-service                           xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
saleorder-xsuaa-service                              xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
sapbuildworkzone                                     build-workzone-standard   foundation                                   create succeeded   sm-portal-2fc6ac3e-7116-4aad-a681-84073a579ade                       no
shiperp-approuter-destination                        destination               lite          shiperp-fiori-test-approuter   create succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
shippingdashboard-app-front-service                  html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
shippingdashboard-destination-service                destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
shippingdashboardsls-app-front-service               html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
shippingdashboardsls-destination-service             destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
shippingdashboardsls-xsuaa-service                   xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
shippingdashboard-xsuaa-service                      xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
submitacefiling-app-front-service                    html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
submitacefiling-destination-service                  destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
submitacefilingsls-app-front-service                 html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
submitacefilingsls-destination-service               destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
submitacefilingsls-xsuaa-service                     xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
submitacefiling-xsuaa-service                        xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
trackshipmentecc-app-front-service                   html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
trackshipmentecc-destination-service                 destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
trackshipmenteccsls-app-front-service                html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
trackshipmenteccsls-destination-service              destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
trackshipmenteccsls-xsuaa-service                    xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
trackshipmentecc-xsuaa-service                       xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
trackshipmentewm-app-front-service                   html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
trackshipmentewm-destination-service                 destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
trackshipmentewmsls-app-front-service                html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
trackshipmentewmsls-destination-service              destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
trackshipmentewmsls-xsuaa-service                    xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
trackshipmentewm-xsuaa-service                       xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
trackshipmenthd6-app-front-service                   html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
trackshipmenthd6-destination-service                 destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
trackshipmenthd6-xsuaa-service                       xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
viewacefiling-app-front-service                      html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
viewacefiling-destination-service                    destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
viewacefilingsls-app-front-service                   html5-apps-repo           app-host                                     create succeeded   sm-html5-apps-repo-sb-4b813d04-dbc7-4163-bc9c-44bd8c79cb32           no
viewacefilingsls-destination-service                 destination               lite                                         update succeeded   sm-destination-service-broker-dea8d48b-34ed-4324-aebd-81f69450a89a   no
viewacefilingsls-xsuaa-service                       xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
viewacefiling-xsuaa-service                          xsuaa                     application                                  update succeeded   sm-xsuaa-f6abf93b-bbc4-4706-84e0-3a60b20c220e                        no
```

## 3. CF service keys

Total service credential bindings (keys + app bindings): 192. Of those, `type=key`: 189.

| Key name | Service instance GUID |
|---|---|
| `submitacefiling-app-content-submitacefiling-app-front-service-credentials` | `a51a6c23-62f9-4a86-995d-f8eec9d87a2b` |
| `freightauditupload-app-content-freightauditupload-app-front-service-credentials` | `8bbce7e4-b86e-4a9b-a847-a21fa75202e6` |
| `html5-key-1779763948` | `8638ca5f-a70b-4a94-acd8-0b5a62d0c8bf` |
| `submitacefiling-xsuaa-service-key` | `ab168d76-b4b1-4207-84ed-00b2029859b9` |
| `submitacefiling-destination-content-submitacefiling-destination-service-credentials` | `c84fa881-eebd-4602-bdbb-c24b4ac6318f` |
| `cancelpickuprequest-xsuaa-service-key` | `65116231-8342-4f04-b073-1f063ef6e104` |
| `cancelpickuprequest-destination-content-cancelpickuprequest-destination-service-credentials` | `62a00323-d594-4b75-a301-5a072e6a4f43` |
| `dispute-destination-content-dispute-destination-service-credentials` | `11387043-4c6f-4c9a-94d6-10e084b8b2d2` |
| `freightaudit-app-content-freightaudit-app-front-service-credentials` | `0c69076d-4767-4423-96f4-5f44fbcff522` |
| `freightaudit-destination-content-freightaudit-destination-service-credentials` | `97b62891-2307-4d6d-980b-285ed3da8d52` |
| `freightauditupload-xsuaa-service-key` | `1335ccbe-e251-45ff-8a2a-021f82fe3439` |
| `freightauditupload-destination-content-freightauditupload-destination-service-credentials` | `cb9cfcf9-375d-441b-af64-13c19ac7ce52` |
| `ltlplanning-destination-content-ltlplanning-destination-service-credentials` | `7c91ee35-3751-405b-8229-f5a877d0623a` |
| `ltlplanning-xsuaa-service-key` | `24c8f78d-9cb8-49f6-ade3-9646303b18d4` |
| `manualshipmentewm-xsuaa-service-key` | `4596f64f-43fc-4a0f-b85a-cf05ec3d8a73` |
| `manualshipmentewm-destination-content-manualshipmentewm-destination-service-credentials` | `3ca8f1f4-84bf-4e65-9d57-ddcd86735dd4` |
| `quickpackewm-app-content-quickpackewm-app-front-service-credentials` | `c69ff16d-31e1-4d95-a814-c17956ace446` |
| `quickpackewm-destination-content-quickpackewm-destination-service-credentials` | `4a7f943c-e1d5-4a54-92a9-7a4b0bd3112b` |
| `requestforpickup-xsuaa-service-key` | `53f93d98-07e0-4a4c-8177-cf36926b3ba3` |
| `requestforpickup-destination-content-requestforpickup-destination-service-credentials` | `d8fca036-3f06-4f7a-beeb-5290ea84cdce` |
| `shippingdashboard-app-content-shippingdashboard-app-front-service-credentials` | `73c07864-55a5-40c4-b7df-9df3a38bed6f` |
| `shippingdashboard-destination-content-shippingdashboard-destination-service-credentials` | `9cdc4545-6b36-4c74-96ab-b6a3ec6b51c4` |
| `viewacefiling-destination-content-viewacefiling-destination-service-credentials` | `6e19bea4-614a-4fea-9e45-9bee6fd5544b` |
| `viewacefiling-xsuaa-service-key` | `3a60cc1e-9df6-4ce2-87d3-9ee10dbe44ca` |
| `freightorderplanning-app-content-freightorderplanning-app-front-service-credentials` | `daa7c457-ba62-424a-9d96-284b6bb807e8` |
| `createshipmentewm-app-content-createshipmentewm-app-front-service-credentials` | `e535e174-3c00-423f-ae86-74a6e23f8df7` |
| `manualshipmentecc-app-content-manualshipmentecc-app-front-service-credentials` | `5031c0bb-e0b2-48c7-b1d2-5053d47c0f53` |
| `carrierperformancereportecc-app-content-carrierperformancereportecc-app-front-service-credentials` | `ff76a18c-8981-49a5-9f69-53a992cea477` |
| `planshipment-app-content-planshipment-app-front-service-credentials` | `377ecfbe-0f5c-4600-ae78-a35a6e069c61` |
| `dispute-app-content-dispute-app-front-service-credentials` | `9a951301-7f6e-41bf-8d98-378cc0a0f17d` |
| `saleorder-app-content-saleorder-app-front-service-credentials` | `54cd2406-af1d-49c2-8efb-47b16840df27` |
| `saleorder-destination-content-saleorder-destination-service-credentials` | `bfce2327-f7ee-4558-84a1-14112ccf0638` |
| `quickpackecc-app-content-quickpackecc-app-front-service-credentials` | `bfbf9ab2-d582-4261-b780-7684f157f3ff` |
| `quickpackecc-destination-content-quickpackecc-destination-service-credentials` | `1e17abef-4475-48af-b88a-255af9fc868b` |
| `dispute-xsuaa-service-key` | `03fcda88-808a-4a63-994a-d155038c618f` |
| `freightaudit-xsuaa-service-key` | `58d17621-ab1a-4b37-b263-3319e9eb2604` |
| `saleorder-xsuaa-service-key` | `f3a8093c-1a5a-40b8-a7bf-6bc2d52b8b54` |
| `quickpackecc-xsuaa-service-key` | `9ca67c74-64b8-4bdf-9fdb-3e93e716f5d1` |
| `quickpackewm-xsuaa-service-key` | `5b3f341c-5404-4087-8e02-b4bce7551943` |
| `shippingdashboard-xsuaa-service-key` | `dcf5fef1-1cee-47dd-ba1b-29b787d12361` |
| `createshipmentv2ewm-app-content-createshipmentv2ewm-app-front-service-credentials` | `ccd5d4b3-55fe-477f-aecf-c67c50475158` |
| `createshipmentv2ewm-xsuaa-service-key` | `4ed39534-1247-4fd8-b088-bf6332a2832c` |
| `createshipmentv2ewm-destination-content-createshipmentv2ewm-destination-service-credentials` | `1bca7250-5614-4e8a-ab63-214a116c039f` |
| `cancelacefiling-xsuaa-service-key` | `8ae4517e-a381-499c-82f2-b25dd8ab408c` |
| `cancelacefiling-destination-content-cancelacefiling-destination-service-credentials` | `a167a84f-0812-44fd-86e6-01c300d56f26` |
| `freightorderplanning-destination-content-freightorderplanning-destination-service-credentials` | `5691af39-944e-45fe-a633-7834d4a2ab59` |
| `createshipmentewm-xsuaa-service-key` | `06a64258-0ed7-410e-9ad9-20fba1ab710e` |
| `createshipmentewm-destination-content-createshipmentewm-destination-service-credentials` | `0bead808-b76a-41bf-97f8-29589fcf9936` |
| `manualshipmentecc-xsuaa-service-key` | `abd42c43-7f91-43fc-9441-1fd02d456202` |
| `manualshipmentecc-destination-content-manualshipmentecc-destination-service-credentials` | `0812fc71-b035-49fd-a9f3-b2b77098f3da` |
| `carrierperformancereportecc-xsuaa-service-key` | `8d8b5484-6fd7-4487-9c07-a654c030af0d` |
| `carrierperformancereportecc-destination-content-carrierperformancereportecc-destination-service-credentials` | `a197c2ae-aa10-4bb1-b5d8-cf3e6d97bde7` |
| `planshipment-xsuaa-service-key` | `3e609c27-3736-4bad-b5c9-7a2475ecc324` |
| `planshipment-destination-content-planshipment-destination-service-credentials` | `6634ed2b-663e-4d29-99b8-d11c65b0e302` |
| `cancelshipmentewm-app-content-cancelshipmentewm-app-front-service-credentials` | `e0c46665-6c12-4903-8a1c-978dd7b5b8c9` |
| `cancelshipmentewm-xsuaa-service-key` | `3d8e44c5-19d9-4cd4-8330-b63578965e9e` |
| `cancelshipmentewm-destination-content-cancelshipmentewm-destination-service-credentials` | `6cea36c0-a554-4b48-b1fa-32899d98fb6d` |
| `closedelivery-app-content-closedelivery-app-front-service-credentials` | `7a16721f-bc70-4779-973f-6e1f6dfb80c6` |
| `closedelivery-xsuaa-service-key` | `8f7bb425-9950-461a-a410-fc7337024795` |
| `closedelivery-destination-content-closedelivery-destination-service-credentials` | `0b862fac-0cf8-4714-81e1-a72b6c3e0b67` |
| `html5-runtime-test-key` | `8638ca5f-a70b-4a94-acd8-0b5a62d0c8bf` |
| `viewacefiling-app-content-viewacefiling-app-front-service-credentials` | `18c5f711-8f27-4a91-95ba-2fb25dc2d02a` |
| `requestforpickup-app-content-requestforpickup-app-front-service-credentials` | `01f9aa37-72b2-4e90-ab9c-9318148705db` |
| `cancelacefiling-app-content-cancelacefiling-app-front-service-credentials` | `337e6be1-3126-49e4-a955-4c14a85f9477` |
| `cancelpickuprequest-app-content-cancelpickuprequest-app-front-service-credentials` | `773a4535-89bd-4de4-b161-e667c1dbbd24` |
| `ltlplanning-app-content-ltlplanning-app-front-service-credentials` | `11fc4bd4-528c-4b1c-910d-028e4060fdfa` |
| `carrierperformancereportewm-app-content-carrierperformancereportewm-app-front-service-credentials` | `f631e88c-0d6a-4990-bbad-bab83fcbb016` |
| `manualshipmentewm-app-content-manualshipmentewm-app-front-service-credentials` | `d063dc4c-f271-4526-9b15-812aa2b21468` |
| `trackshipmentewm-app-content-trackshipmentewm-app-front-service-credentials` | `be372495-56dc-419b-ac2c-50cf4c6a5808` |
| `trackshipmentewm-xsuaa-service-key` | `0f4cd697-580b-4bdb-a3a6-e29dfd13e582` |
| `trackshipmentewm-destination-content-trackshipmentewm-destination-service-credentials` | `a4a44fe8-281d-48d6-81bc-4239963e8d19` |
| `carrierperformancereportewm-destination-content-carrierperformancereportewm-destination-service-credentials` | `f5af55e1-329f-49b8-8988-20a176ee1b12` |
| `shiperp-mcp-key` | `d14ef740-396e-43fb-a342-f5735c4fa63c` |
| `cancelshipmentecc-app-content-cancelshipmentecc-app-front-service-credentials` | `e8258bf2-2695-4dd4-9cc4-7fd96fad1610` |
| `cancelshipmentecc-xsuaa-service-key` | `98a39ec1-bd36-4f77-ac42-0e01ae63e6aa` |
| `cancelshipmentecc-destination-content-cancelshipmentecc-destination-service-credentials` | `bdded39b-e990-4f80-8daa-9d1b24805f6f` |
| `createshipmentecc-app-content-createshipmentecc-app-front-service-credentials` | `b1b16768-c9e7-4571-8ddd-f0152d8fe605` |
| `createshipmentecc-xsuaa-service-key` | `dfe84787-8f27-4c3e-b4cd-05023479305e` |
| `createshipmentecc-destination-content-createshipmentecc-destination-service-credentials` | `184628b3-acf8-4099-a3ac-438ea1c373f7` |
| `trackshipmentecc-app-content-trackshipmentecc-app-front-service-credentials` | `abcccfc5-5d19-4099-883a-81b00941fa66` |
| `trackshipmentecc-xsuaa-service-key` | `19986be3-8219-48b8-a1ad-da7b209708ce` |
| `trackshipmentecc-destination-content-trackshipmentecc-destination-service-credentials` | `cb4c87a5-eccf-48a1-a368-961a435f8d95` |
| `disputesls-app-content-disputesls-app-front-service-credentials` | `6122283c-2408-4eda-a8d3-fb5c254640ca` |
| `disputesls-xsuaa-service-key` | `e12c8496-67c3-4e0b-9c68-110ec793833e` |
| `disputesls-destination-content-disputesls-destination-service-credentials` | `4f4f9a8b-a414-495d-b5b9-89e094682c24` |
| `freightauditsls-app-content-freightauditsls-app-front-service-credentials` | `2cb8a19e-de9d-4ab7-b2a8-869e609a3d97` |
| `freightauditsls-destination-content-freightauditsls-destination-service-credentials` | `dfb526fd-aaab-4236-aaa5-d431bb852d6e` |
| `freightauditsls-xsuaa-service-key` | `7b421ce3-cda1-4ddf-983e-a69913cd23eb` |
| `freightorderplanningsls-app-content-freightorderplanningsls-app-front-service-credentials` | `d86fde5a-c8d0-459c-a002-792822364899` |
| `freightorderplanningsls-xsuaa-service-key` | `e0e72adb-8367-41c0-82cc-aa9a200ba871` |
| `freightorderplanningsls-destination-content-freightorderplanningsls-destination-service-credentials` | `142c95cd-b24b-4ba4-90b7-2ac1783f4029` |
| `manualshipmentewmsls-app-content-manualshipmentewmsls-app-front-service-credentials` | `878cf2ed-99ec-4493-9b7f-11dcec716e9a` |
| `manualshipmentewmsls-xsuaa-service-key` | `e36a955e-315b-441d-ae34-d48934401cb8` |
| `manualshipmentewmsls-destination-content-manualshipmentewmsls-destination-service-credentials` | `9840ffa6-d316-463a-a457-cc756910972f` |
| `manualshipmenteccsls-app-content-manualshipmenteccsls-app-front-service-credentials` | `bd00badf-497e-49a1-8cc9-1ba32a5ee637` |
| `manualshipmenteccsls-destination-content-manualshipmenteccsls-destination-service-credentials` | `84954229-37eb-4023-a0af-90289d252183` |
| `manualshipmenteccsls-xsuaa-service-key` | `60daee14-ec6f-4265-8020-3a0db2e2d2bf` |
| `createshipmenteccsls-app-content-createshipmenteccsls-app-front-service-credentials` | `dbf428b1-1502-45df-a24d-1752ee1f4781` |
| `createshipmenteccsls-xsuaa-service-key` | `b01caf62-0142-475f-8fb2-ab93742bba2b` |
| `createshipmenteccsls-destination-content-createshipmenteccsls-destination-service-credentials` | `bca220c4-1def-45ec-85fc-b3ac7c9d2fb1` |
| `quickpackeccsls-xsuaa-service-key` | `0a1c78ac-3963-4443-8830-b731a58988ac` |
| `quickpackeccsls-destination-content-quickpackeccsls-destination-service-credentials` | `524c354f-f246-44b8-84dd-d49e3a15aded` |
| `saleordersls-app-content-saleordersls-app-front-service-credentials` | `887e1f90-5bac-4ed9-87fd-376d3a41bade` |
| `saleordersls-xsuaa-service-key` | `0f48a37a-456d-481d-8949-2264a437f710` |
| `saleordersls-destination-content-saleordersls-destination-service-credentials` | `772af4b0-f410-4e8a-8566-9aa75f429dd5` |
| `createshipmentewmsls-app-content-createshipmentewmsls-app-front-service-credentials` | `c110a13a-31cb-47ab-878b-e5a38e693f8e` |
| `createshipmentewmsls-xsuaa-service-key` | `b828dc62-6d0d-4389-852d-7baf499bdfb3` |
| `createshipmentewmsls-destination-content-createshipmentewmsls-destination-service-credentials` | `c782b074-4646-4a2c-9c13-f6f34c967fc8` |
| `shippingdashboardsls-app-content-shippingdashboardsls-app-front-service-credentials` | `bd11e971-f874-4804-837d-f8fd05a13134` |
| `shippingdashboardsls-xsuaa-service-key` | `a7b77a2f-4479-4134-8c16-9e8e6b66eda8` |
| `shippingdashboardsls-destination-content-shippingdashboardsls-destination-service-credentials` | `3b97bd8f-12dd-494f-9e64-1f8477415dae` |
| `trackshipmentewmsls-app-content-trackshipmentewmsls-app-front-service-credentials` | `46ef669d-9faf-47bd-9adc-63a3bae12c25` |
| `trackshipmentewmsls-xsuaa-service-key` | `92626ae4-a35b-4f01-b234-6b84c0df010b` |
| `trackshipmentewmsls-destination-content-trackshipmentewmsls-destination-service-credentials` | `f38890e5-c74b-4ff1-abaf-8b48ec610d04` |
| `cancelshipmenteccsls-app-content-cancelshipmenteccsls-app-front-service-credentials` | `a153f10a-dc9b-4314-a952-ccde165841fc` |
| `cancelshipmenteccsls-xsuaa-service-key` | `622a76d2-0d5d-476d-8b15-f6ab58212e54` |
| `cancelshipmenteccsls-destination-content-cancelshipmenteccsls-destination-service-credentials` | `b837b085-ac64-4c3d-a399-36edcd18e035` |
| `cancelacefilingsls-app-content-cancelacefilingsls-app-front-service-credentials` | `6f00a026-f009-446a-a0db-31743b6d6600` |
| `cancelacefilingsls-xsuaa-service-key` | `a65dbe8e-df41-4ebf-8993-b2217d417eda` |
| `cancelacefilingsls-destination-content-cancelacefilingsls-destination-service-credentials` | `811ab968-37f9-468d-814e-805ba8ec3630` |
| `submitacefilingsls-app-content-submitacefilingsls-app-front-service-credentials` | `5c519421-c83e-4e11-bea9-f0b9953fa85b` |
| `submitacefilingsls-xsuaa-service-key` | `06060f37-1a43-4e75-b7c2-759d7c596538` |
| `submitacefilingsls-destination-content-submitacefilingsls-destination-service-credentials` | `3d12fd7a-8af8-4dc0-b6ca-b4b83bb4b8d1` |
| `viewacefilingsls-app-content-viewacefilingsls-app-front-service-credentials` | `127262bf-96e3-42c8-a8a9-d63207e574c8` |
| `viewacefilingsls-xsuaa-service-key` | `61c1ae51-5ff2-4f8a-a56d-35cb430c9e10` |
| `viewacefilingsls-destination-content-viewacefilingsls-destination-service-credentials` | `4895c8e5-011b-4adc-b552-3bc2ed1a16ad` |
| `cancelshipmentewmsls-app-content-cancelshipmentewmsls-app-front-service-credentials` | `42184ebc-f8e0-4cfa-901a-5ebb23dd6947` |
| `cancelshipmentewmsls-xsuaa-service-key` | `eb94631c-d916-41af-9aa9-35910703667d` |
| `cancelshipmentewmsls-destination-content-cancelshipmentewmsls-destination-service-credentials` | `53b3b031-557c-4aea-a6f4-2a78f184c2d8` |
| `cancelpickuprequestsls-app-content-cancelpickuprequestsls-app-front-service-credentials` | `af5f3ee5-8e07-4047-bbb6-31efa627b3ff` |
| `cancelpickuprequestsls-xsuaa-service-key` | `ce20e455-217b-4aa2-957e-ac5d64ff3d49` |
| `cancelpickuprequestsls-destination-content-cancelpickuprequestsls-destination-service-credentials` | `b3403b0c-f2df-4c8c-8204-b06064c2b77f` |
| `requestforpickupsls-app-content-requestforpickupsls-app-front-service-credentials` | `b85b3af8-a04e-4953-b3d9-15716c07344c` |
| `requestforpickupsls-destination-content-requestforpickupsls-destination-service-credentials` | `8cfc5357-8de8-4ebd-8310-f2d4efcaa1eb` |
| `requestforpickupsls-xsuaa-service-key` | `9364ec08-507a-4b59-bb95-5043645b1f69` |
| `carrierperformancereporteccsls-app-content-carrierperformancereporteccsls-app-front-service-credentials` | `a6f81855-8cf6-48af-927d-6098cf818c23` |
| `carrierperformancereporteccsls-xsuaa-service-key` | `b3d6d398-71e8-437a-be15-8bb06f63c41e` |
| `carrierperformancereporteccsls-destination-content-carrierperformancereporteccsls-destination-service-credentials` | `ba3e4954-2540-4bb4-ac63-9d4e4a30b230` |
| `carrierperformancereportewmsls-app-content-carrierperformancereportewmsls-app-front-service-credentials` | `fef533e8-4959-422a-9d09-1ca2b2b0d278` |
| `carrierperformancereportewmsls-xsuaa-service-key` | `02f05f4d-6f39-4282-bba3-6b89808b8bc6` |
| `carrierperformancereportewmsls-destination-content-carrierperformancereportewmsls-destination-service-credentials` | `76986626-1af7-419c-89c9-2f8c8756f06a` |
| `closedeliverysls-app-content-closedeliverysls-app-front-service-credentials` | `790e338d-abd8-4203-b414-23a30f655e30` |
| `closedeliverysls-destination-content-closedeliverysls-destination-service-credentials` | `90855868-3524-491a-9484-697c48b21383` |
| `closedeliverysls-xsuaa-service-key` | `f81d2f5e-aed3-4118-87d1-8c6d9ca1871a` |
| `ltlplanningsls-app-content-ltlplanningsls-app-front-service-credentials` | `2e425c4e-b1e1-447d-9c42-acabaee60728` |
| `ltlplanningsls-xsuaa-service-key` | `75cbbe7a-1896-4d08-9821-e2ec7d6216ed` |
| `ltlplanningsls-destination-content-ltlplanningsls-destination-service-credentials` | `8c27c0ba-e2bf-4e46-b9ce-4627232903bb` |
| `planshipmentsls-app-content-planshipmentsls-app-front-service-credentials` | `9c2464e6-428d-43b7-8f75-6f4d37772fe0` |
| `planshipmentsls-xsuaa-service-key` | `708aaf7e-c4a3-4b73-91fd-7df5f618dab1` |
| `planshipmentsls-destination-content-planshipmentsls-destination-service-credentials` | `d12f2598-c0fa-4fd0-9ab3-7385bf9e0dbf` |
| `createshipmentv2ewmsls-app-content-createshipmentv2ewmsls-app-front-service-credentials` | `e65842da-2387-414f-a447-307239233520` |
| `createshipmentv2ewmsls-xsuaa-service-key` | `134289f4-522b-4ead-827b-ba2a0d18f77a` |
| `createshipmentv2ewmsls-destination-content-createshipmentv2ewmsls-destination-service-credentials` | `ad2fffa3-61fe-48ea-9f84-6757c5fc29a9` |
| `freightaudituploadsls-app-content-freightaudituploadsls-app-front-service-credentials` | `735762a2-6c60-4205-a903-795d9dccbfea` |
| `freightaudituploadsls-xsuaa-service-key` | `02364a44-410f-445a-bacb-1e29dd2c0403` |
| `freightaudituploadsls-destination-content-freightaudituploadsls-destination-service-credentials` | `fa8c660d-9d31-4662-9212-8465dcbeb86b` |
| `quickpackewmsls-app-content-quickpackewmsls-app-front-service-credentials` | `e5bd6184-5744-4641-8039-0045b5cf2608` |
| `quickpackewmsls-xsuaa-service-key` | `55a9d539-d587-45ec-944b-6d5437accfcb` |
| `quickpackewmsls-destination-content-quickpackewmsls-destination-service-credentials` | `e8ce2396-3c89-443c-b5e8-93390881be2d` |
| `trackshipmenteccsls-app-content-trackshipmenteccsls-app-front-service-credentials` | `f13c69e4-788a-40f2-a60a-7821f4bb150c` |
| `trackshipmenteccsls-xsuaa-service-key` | `c81c1563-1997-442d-a952-14f91f959c2e` |
| `trackshipmenteccsls-destination-content-trackshipmenteccsls-destination-service-credentials` | `ebc3ddc0-72e3-4c47-abfe-902330f57144` |
| `quickpackeccsls-app-content-quickpackeccsls-app-front-service-credentials` | `8dbf8c65-8133-464b-a93d-23ffc25a7981` |
| `cancelhd6-app-content-cancelhd6-app-front-service-credentials` | `0259608d-b677-4a1b-947d-8093cd0c1c7a` |
| `cancelhd6-xsuaa-service-key` | `38a43c26-2792-4912-8129-59f45cfac04b` |
| `cancelhd6-destination-content-cancelhd6-destination-service-credentials` | `d403ded5-fc13-4647-b5e5-681f80e352cf` |
| `disputehd6-app-content-disputehd6-app-front-service-credentials` | `c961a527-72d4-4192-9881-bf89c205b92b` |
| `disputehd6-xsuaa-service-key` | `580d94d9-f5ba-4dad-8e4d-2a68b0791c4e` |
| `disputehd6-destination-content-disputehd6-destination-service-credentials` | `c83c398e-33f4-48b2-9214-b35015671239` |
| `eodhd6-app-content-eodhd6-app-front-service-credentials` | `12734732-6a2d-4e90-8599-eea459a32522` |
| `eodhd6-xsuaa-service-key` | `f98c39a6-c486-4d34-bf2e-410d27fbd4f0` |
| `eodhd6-destination-content-eodhd6-destination-service-credentials` | `9aba6d0a-1598-4301-82af-015563ac20de` |
| `farpthd6-app-content-farpthd6-app-front-service-credentials` | `2fa555a6-11d4-44e4-999b-6d251c7592c9` |
| `farpthd6-destination-content-farpthd6-destination-service-credentials` | `276433b8-5e2c-4072-90c7-e974915b8cf2` |
| `farpthd6-xsuaa-service-key` | `9c91bec9-bc85-4d97-8d60-5548ca2eaa2d` |
| `freightaudithd6-app-content-freightaudithd6-app-front-service-credentials` | `0bb12dd6-ac16-49c1-97d8-2ee73beb7bc8` |
| `freightaudithd6-xsuaa-service-key` | `880a90f1-a191-4024-be25-91b66a9df98f` |
| `freightaudithd6-destination-content-freightaudithd6-destination-service-credentials` | `9f1ff735-4223-4adb-abe7-2a8180ba4072` |
| `parcelhd6-app-content-parcelhd6-app-front-service-credentials` | `8b181577-72dc-4c0f-9824-01008d2242c8` |
| `parcelhd6-destination-content-parcelhd6-destination-service-credentials` | `a27513c8-979d-46ec-817c-19d3006612e1` |
| `parcelhd6-xsuaa-service-key` | `70e4afcc-16e8-4a21-a225-4b43884dd144` |
| `parceldemohd6-app-content-parceldemohd6-app-front-service-credentials` | `70fefba0-9e3c-4917-ba46-ebd26fbf6fc0` |
| `parceldemohd6-destination-content-parceldemohd6-destination-service-credentials` | `9e2be96c-73c2-4629-ae37-dfd306e500d9` |
| `parceldemohd6-xsuaa-service-key` | `db2e6c61-8054-4b9e-b851-419c541eb535` |
| `trackshipmenthd6-app-content-trackshipmenthd6-app-front-service-credentials` | `c67f6f37-d7fc-4769-b7a2-b11e9d8f9a7c` |
| `trackshipmenthd6-xsuaa-service-key` | `ab07d17b-c05c-4737-934b-f7084d0aa1d3` |
| `trackshipmenthd6-destination-content-trackshipmenthd6-destination-service-credentials` | `6dd1fb23-92c0-4c78-9fae-1e76a837653e` |
| `freightorderplanning-xsuaa-service-key` | `616c34a2-8b49-47bd-9862-cab92930edda` |
| `carrierperformancereportewm-xsuaa-service-key` | `69e5d786-4745-4432-b430-e8827ce55745` |

## 4. Subaccount-level destinations

Total subaccount destinations: 18.

### `ui5cdn`

```json
{
  "Name": "ui5cdn",
  "Type": "HTTP",
  "Description": "",
  "URL": "https://ui5.sap.com",
  "ProxyType": "Internet",
  "Authentication": "NoAuthentication"
}
```
### `S23`

```json
{
  "User": "btpuser",
  "WebIDEEnabled": "true",
  "sap-client": "100",
  "URL": "http://erps42023.erp-is.com:4430",
  "Name": "S23",
  "WebIDEUsage": "dev_abap,odata_abap,bsp_execute_abap,ui5_execute_abap",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "Authentication": "BasicAuthentication",
  "HTML5.Timeout": "120000",
  "ProxyType": "OnPremise",
  "WebIDESystem": "S23",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `A5F`

```json
{
  "audience": "https://my425417.s4hana.cloud.sap",
  "authnContextClassRef": "urn:oasis:names:tc:SAML:2.0:ac:classes:PreviousSession",
  "WebIDEEnabled": "true",
  "URL": "https://my425417-api.s4hana.cloud.sap",
  "Name": "A5F",
  "WebIDEUsage": "odata_abap, dev_abap",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "clientKey": "",
  "Authentication": "SAMLAssertion",
  "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "HTML5.Timeout": "60000",
  "ProxyType": "Internet"
}
```
### `CD4`

```json
{
  "Description": "Clean Core Development",
  "User": "BTPUSER",
  "WebIDEEnabled": "true",
  "sap-client": "100",
  "URL": "http://erps42023cd.erp-is.com:4430",
  "Name": "CD4",
  "WebIDEUsage": "dev_abap,odata_abap,bsp_execute_abap,ui5_execute_abap",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "Authentication": "BasicAuthentication",
  "HTML5.Timeout": "120000",
  "ProxyType": "OnPremise",
  "WebIDESystem": "CD4",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `S4HC_my429106`

```json
{
  "Name": "S4HC_my429106",
  "Type": "HTTP",
  "Description": "",
  "URL": "https://my429106-api.s4hana.cloud.sap",
  "ProxyType": "Internet",
  "Authentication": "SAMLAssertion",
  "WebIDEEnabled": "true",
  "WebIDEUsage": "odata_abap,dev_abap",
  "HTML5.DynamicDestination": "true",
  "HTML5.Timeout": "60000",
  "authnContextClassRef": "urn:oasis:names:tc:SAML:2.0:ac:classes:PreviousSession",
  "audience": "https://my429106.s4hana.cloud.sap",
  "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "skipUserAttributesPrefixInSAMLAttributes": "false",
  "includeSigningCertificateInSAMLAssertion": "false",
  "skipUserUuidInSAMLAttributes": "false",
  "abap_enabled": "true",
  "userIdSource": "email"
}
```
### `CD4_PWANGDALI`

```json
{
  "Description": "Clean Core Development",
  "User": "PWANGDALI",
  "WebIDEEnabled": "true",
  "sap-client": "100",
  "URL": "http://erps42023cd.erp-is.com:4430",
  "Name": "CD4_PWANGDALI",
  "WebIDEUsage": "dev_abap,odata_abap,bsp_execute_abap,ui5_execute_abap",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "Authentication": "BasicAuthentication",
  "HTML5.Timeout": "120000",
  "ProxyType": "OnPremise",
  "WebIDESystem": "CD4",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `S4HC_SO_A2X`

```json
{
  "User": "BTPUSER",
  "WebIDEEnabled": "true",
  "sap-client": "100",
  "URL": "https://my425417-api.s4hana.cloud.sap/sap/opu/odata4/iwfnd/config/default/iwfnd/catalog/0001/?sap-client=080",
  "Name": "S4HC_SO_A2X",
  "WebIDEUsage": "odata_gen",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "Authentication": "BasicAuthentication",
  "HTML5.Timeout": "120000",
  "ProxyType": "Internet",
  "WebIDESystem": "S4HC",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `a5f_so`

```json
{
  "Name": "a5f_so",
  "Type": "HTTP",
  "Description": "",
  "URL": "https://my425417-api.s4hana.cloud.sap/sap/opu/odata/sap/API_SALES_ORDER_SRV",
  "ProxyType": "Internet",
  "Authentication": "BasicAuthentication",
  "User": "btpuser",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `A5F_SAML`

```json
{
  "tokenServiceURLType": "Dedicated",
  "audience": "https://my425417.s4hana.cloud.sap",
  "authnContextClassRef": "urn:oasis:names:tc:SAML:2.0:ac:classes:PreviousSession",
  "WebIDEEnabled": "true",
  "URL": "https://my425417-api.s4hana.cloud.sap",
  "Name": "A5F_SAML",
  "WebIDEUsage": "odata_abap, dev_abap",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "clientKey": "",
  "Authentication": "SAMLAssertion",
  "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  "HTML5.Timeout": "60000",
  "ProxyType": "Internet",
  "userIdSource": "email",
  "SAMLAssertionProvider": "DestinationServiceGenerated"
}
```
### `HELLO_SVC`

```json
{
  "Name": "HELLO_SVC",
  "Type": "HTTP",
  "Description": "",
  "URL": "https://my429099-api.s4hana.cloud.sap",
  "ProxyType": "Internet",
  "Authentication": "NoAuthentication"
}
```
### `S4HC_my429099`

```json
{
  "Name": "S4HC_my429099",
  "Type": "HTTP",
  "Description": "",
  "URL": "https://my429099-api.s4hana.cloud.sap",
  "ProxyType": "Internet",
  "Authentication": "BasicAuthentication",
  "User": "COMMUSER_1",
  "Password": "\u00abREDACTED\u00bb",
  "sap-client": "100",
  "WebIDEEnabled": "true",
  "WebIDEUsage": "odata_abap,dev_abap,ui5_execute_abap",
  "WebIDESystem": "S4HC_my429099",
  "HTML5.DynamicDestination": "true",
  "HTML5.Timeout": "60000"
}
```
### `MIZUHO_S4D`

```json
{
  "Description": "Clean Core Development",
  "User": "PWANGDALI",
  "WebIDEEnabled": "true",
  "sap-client": "100",
  "URL": "http://VHMIZS4DCI.HEC.MIZUHOSI.COM:4430",
  "Name": "MIZUHO_S4D",
  "WebIDEUsage": "dev_abap,odata_abap,bsp_execute_abap,ui5_execute_abap",
  "Type": "HTTP",
  "HTML5.DynamicDestination": "true",
  "Authentication": "BasicAuthentication",
  "HTML5.Timeout": "120000",
  "ProxyType": "OnPremise",
  "WebIDESystem": "CD4",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `Northwind`

```json
{
  "Name": "Northwind",
  "Authentication": "NoAuthentication",
  "ProxyType": "Internet",
  "Type": "HTTP",
  "Description": "Northwind OData demo service",
  "URL": "https://services.odata.org"
}
```
### `virtual-erps4sales-destination`

```json
{
  "Name": "virtual-erps4sales-destination",
  "Type": "HTTP",
  "URL": "http://erps4sales.erp-is.com:50000",
  "Authentication": "BasicAuthentication",
  "ProxyType": "OnPremise",
  "ProxyProtocol": "HTTPS",
  "User": "PWANGDALI",
  "Password": "\u00abREDACTED\u00bb",
  "Description": "SLS - ERP S4 SALES",
  "WebIDEEnabled": "true",
  "WebIDESystem": "SLS",
  "WebIDEUsage": "odata_abap,odata_gen",
  "HTML5.DynamicDestination": "true"
}
```
### `virtual-hr7-destination`

```json
{
  "Usage": "Backend",
  "HTML5.DynamicDestination": "true",
  "Type": "HTTP",
  "User": "PWANGDALI",
  "Authentication": "BasicAuthentication",
  "WebIDEEnabled": "true",
  "ProxyType": "OnPremise",
  "WebIDESystem": "HR7",
  "URL": "http://virtual-s4hr7.erp-is.com:50000",
  "WebIDEUsage": "odata_abap, odata_gen, odata_smp, odata_hcp_odp, odata_xs, dev_abap, ui5_execute_abap, bsp_execute_abap, api_mgmt_catalog, odata_hci",
  "Name": "virtual-hr7-destination",
  "ClientReadTimeout": "300000",
  "ProxyProtocol": "HTTPS",
  "Password": "\u00abREDACTED\u00bb"
}
```
### `shiperp-virtual-hr7-destination`

```json
{
  "Name": "shiperp-virtual-hr7-destination",
  "Type": "HTTP",
  "URL": "http://virtual-s4hr7.erp-is.com:50000",
  "Authentication": "BasicAuthentication",
  "ProxyType": "OnPremise",
  "User": "USER_CF",
  "Password": "\u00abREDACTED\u00bb",
  "Description": "ShipERP migration: HR7 backend (USER_CF)",
  "HTML5DynamicDestination": "true",
  "WebIDEEnabled": "true",
  "WebIDEUsage": "odata_abap,ui5_execute_abap,dev_abap"
}
```
### `shiperp-virtual-erps4sales-destination`

```json
{
  "Name": "shiperp-virtual-erps4sales-destination",
  "Type": "HTTP",
  "URL": "http://erps4sales.erp-is.com:50000",
  "Authentication": "BasicAuthentication",
  "ProxyType": "OnPremise",
  "User": "USER_CF",
  "Password": "\u00abREDACTED\u00bb",
  "Description": "ShipERP migration: SLS backend (USER_CF)",
  "HTML5DynamicDestination": "true",
  "WebIDEEnabled": "true",
  "WebIDEUsage": "odata_abap,ui5_execute_abap,dev_abap"
}
```
### `shiperp-virtual-hd6-destination`

```json
{
  "Name": "shiperp-virtual-hd6-destination",
  "Type": "HTTP",
  "URL": "http://virtual-s4hd6.erp-is.com:8000",
  "Authentication": "BasicAuthentication",
  "ProxyType": "OnPremise",
  "User": "USER_CF",
  "Password": "\u00abREDACTED\u00bb",
  "Description": "ShipERP migration: HD6 backend (USER_CF)",
  "HTML5DynamicDestination": "true",
  "WebIDEEnabled": "true",
  "WebIDEUsage": "odata_abap,ui5_execute_abap,dev_abap"
}
```

## 5. Instance-level destinations (per-app)

For each of the 62 per-app destination services, listing the entries it carries. After §27.5 cleanup, each service holds the two MTA-managed entries: `{app}-app-front-service` and `{app}-xsuaa-service`.

| App | Instance destinations |
|---|---|
| `cancelacefiling` | `cancelacefiling-app-front-service`, `cancelacefiling-xsuaa-service` |
| `cancelpickuprequest` | `cancelpickuprequest-app-front-service`, `cancelpickuprequest-xsuaa-service` |
| `cancelshipmentecc` | `cancelshipmentecc-app-front-service`, `cancelshipmentecc-xsuaa-service` |
| `cancelshipmentewm` | `cancelshipmentewm-app-front-service`, `cancelshipmentewm-xsuaa-service` |
| `carrierperformancereportecc` | `carrierperformancereportecc-app-front-service`, `carrierperformancereportecc-xsuaa-service` |
| `carrierperformancereportewm` | `carrierperformancereportewm-app-front-service`, `carrierperformancereportewm-xsuaa-service` |
| `closedelivery` | `closedelivery-app-front-service`, `closedelivery-xsuaa-service` |
| `createshipmentecc` | `createshipmentecc-app-front-service`, `createshipmentecc-xsuaa-service` |
| `createshipmentewm` | `createshipmentewm-app-front-service`, `createshipmentewm-xsuaa-service` |
| `createshipmentv2ewm` | `createshipmentv2ewm-app-front-service`, `createshipmentv2ewm-xsuaa-service` |
| `dispute` | `dispute-app-front-service`, `dispute-xsuaa-service` |
| `freightaudit` | `freightaudit-app-front-service`, `freightaudit-xsuaa-service` |
| `freightauditupload` | `freightauditupload-app-front-service`, `freightauditupload-xsuaa-service` |
| `freightorderplanning` | `freightorderplanning-app-front-service`, `freightorderplanning-xsuaa-service` |
| `ltlplanning` | `ltlplanning-app-front-service`, `ltlplanning-xsuaa-service` |
| `manualshipmentecc` | `manualshipmentecc-app-front-service`, `manualshipmentecc-xsuaa-service` |
| `manualshipmentewm` | `manualshipmentewm-app-front-service`, `manualshipmentewm-xsuaa-service` |
| `planshipment` | `planshipment-app-front-service`, `planshipment-xsuaa-service` |
| `quickpackecc` | `quickpackecc-app-front-service`, `quickpackecc-xsuaa-service` |
| `quickpackewm` | `quickpackewm-app-front-service`, `quickpackewm-xsuaa-service` |
| `requestforpickup` | `requestforpickup-app-front-service`, `requestforpickup-xsuaa-service` |
| `saleorder` | `saleorder-xsuaa-service`, `saleorder-app-front-service` |
| `shippingdashboard` | `Northwind`, `shippingdashboard-app-front-service`, `shippingdashboard-xsuaa-service` |
| `submitacefiling` | `submitacefiling-xsuaa-service`, `submitacefiling-app-front-service` |
| `trackshipmentecc` | `trackshipmentecc-app-front-service`, `trackshipmentecc-xsuaa-service` |
| `trackshipmentewm` | `trackshipmentewm-app-front-service`, `trackshipmentewm-xsuaa-service` |
| `viewacefiling` | `viewacefiling-app-front-service`, `viewacefiling-xsuaa-service` |
| `cancelacefilingsls` | `cancelacefilingsls-app-front-service`, `cancelacefilingsls-xsuaa-service` |
| `cancelpickuprequestsls` | `cancelpickuprequestsls-app-front-service`, `cancelpickuprequestsls-xsuaa-service` |
| `cancelshipmenteccsls` | `cancelshipmenteccsls-xsuaa-service`, `cancelshipmenteccsls-app-front-service` |
| `cancelshipmentewmsls` | `cancelshipmentewmsls-app-front-service`, `cancelshipmentewmsls-xsuaa-service` |
| `carrierperformancereporteccsls` | `carrierperformancereporteccsls-app-front-service`, `carrierperformancereporteccsls-xsuaa-service` |
| `carrierperformancereportewmsls` | `carrierperformancereportewmsls-app-front-service`, `carrierperformancereportewmsls-xsuaa-service` |
| `closedeliverysls` | `closedeliverysls-app-front-service`, `closedeliverysls-xsuaa-service` |
| `createshipmenteccsls` | `createshipmenteccsls-xsuaa-service`, `createshipmenteccsls-app-front-service` |
| `createshipmentewmsls` | `createshipmentewmsls-xsuaa-service`, `createshipmentewmsls-app-front-service` |
| `createshipmentv2ewmsls` | `createshipmentv2ewmsls-xsuaa-service`, `createshipmentv2ewmsls-app-front-service` |
| `disputesls` | `disputesls-app-front-service`, `disputesls-xsuaa-service` |
| `freightauditsls` | `freightauditsls-app-front-service`, `freightauditsls-xsuaa-service` |
| `freightaudituploadsls` | `freightaudituploadsls-app-front-service`, `freightaudituploadsls-xsuaa-service` |
| `freightorderplanningsls` | `freightorderplanningsls-xsuaa-service`, `freightorderplanningsls-app-front-service` |
| `ltlplanningsls` | `ltlplanningsls-app-front-service`, `ltlplanningsls-xsuaa-service` |
| `manualshipmenteccsls` | `manualshipmenteccsls-xsuaa-service`, `manualshipmenteccsls-app-front-service` |
| `manualshipmentewmsls` | `manualshipmentewmsls-xsuaa-service`, `manualshipmentewmsls-app-front-service` |
| `planshipmentsls` | `planshipmentsls-app-front-service`, `planshipmentsls-xsuaa-service` |
| `quickpackeccsls` | `quickpackeccsls-xsuaa-service`, `quickpackeccsls-app-front-service` |
| `quickpackewmsls` | `quickpackewmsls-app-front-service`, `quickpackewmsls-xsuaa-service` |
| `requestforpickupsls` | `requestforpickupsls-app-front-service`, `requestforpickupsls-xsuaa-service` |
| `saleordersls` | `saleordersls-xsuaa-service`, `saleordersls-app-front-service` |
| `shippingdashboardsls` | `shippingdashboardsls-app-front-service`, `shippingdashboardsls-xsuaa-service` |
| `submitacefilingsls` | `submitacefilingsls-app-front-service`, `submitacefilingsls-xsuaa-service` |
| `trackshipmenteccsls` | `trackshipmenteccsls-app-front-service`, `trackshipmenteccsls-xsuaa-service` |
| `trackshipmentewmsls` | `trackshipmentewmsls-xsuaa-service`, `trackshipmentewmsls-app-front-service` |
| `viewacefilingsls` | `viewacefilingsls-app-front-service`, `viewacefilingsls-xsuaa-service` |
| `cancelhd6` | `cancelhd6-xsuaa-service`, `cancelhd6-app-front-service` |
| `disputehd6` | `disputehd6-app-front-service`, `disputehd6-xsuaa-service` |
| `eodhd6` | `eodhd6-app-front-service`, `eodhd6-xsuaa-service` |
| `farpthd6` | `farpthd6-app-front-service`, `farpthd6-xsuaa-service` |
| `freightaudithd6` | `freightaudithd6-app-front-service`, `freightaudithd6-xsuaa-service` |
| `parceldemohd6` | `parceldemohd6-app-front-service`, `parceldemohd6-xsuaa-service` |
| `parcelhd6` | `parcelhd6-app-front-service`, `parcelhd6-xsuaa-service` |
| `trackshipmenthd6` | `trackshipmenthd6-app-front-service`, `trackshipmenthd6-xsuaa-service` |

Successful fetches: 62 / 62. Failed: 0.

## 6. Cloud Connector mappings + resources

Source of truth: SLM CC at `https://erpslm1.erp-is.com:8443/` (default Location ID for the `btp_cf` subaccount).

Cross-check via the CC admin UI: `https://erpslm1.erp-is.com:8443/` → btp_cf subaccount → *Cloud to On-Premise* → *System Mappings*.

Mappings documented in §26.9 — all three returned HTTP 201 on creation and were verified live across all 3 backends via §34.3 + §36.2 OData round-trips.

| virtualHost | virtualPort | localHost | localPort | backendType | hostInHeader | Resources |
|---|---|---|---|---|---|---|
| `virtual-s4hr7.erp-is.com`  | 50000 | `s4hr7.erp-is.com`       | 50000 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |
| `erps4sales.erp-is.com`     | 50000 | `erps4sales.erp-is.com`  | 50000 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |
| `virtual-s4hd6.erp-is.com`  |  8000 | `s4hd6.erp-is.com`       |  8001 | abapSys | VIRTUAL | `/` (PATH_AND_ALL_SUB_PATHS) |

## 7. Service-instance to app mapping table

For each of the 62 apps, the 3 CF service instances it owns:

| App | app-front-service (html5-apps-repo) | destination-service | xsuaa-service |
|---|---|---|---|
| `cancelacefiling` | `cancelacefiling-app-front-service` | `cancelacefiling-destination-service` | `cancelacefiling-xsuaa-service` |
| `cancelpickuprequest` | `cancelpickuprequest-app-front-service` | `cancelpickuprequest-destination-service` | `cancelpickuprequest-xsuaa-service` |
| `cancelshipmentecc` | `cancelshipmentecc-app-front-service` | `cancelshipmentecc-destination-service` | `cancelshipmentecc-xsuaa-service` |
| `cancelshipmentewm` | `cancelshipmentewm-app-front-service` | `cancelshipmentewm-destination-service` | `cancelshipmentewm-xsuaa-service` |
| `carrierperformancereportecc` | `carrierperformancereportecc-app-front-service` | `carrierperformancereportecc-destination-service` | `carrierperformancereportecc-xsuaa-service` |
| `carrierperformancereportewm` | `carrierperformancereportewm-app-front-service` | `carrierperformancereportewm-destination-service` | `carrierperformancereportewm-xsuaa-service` |
| `closedelivery` | `closedelivery-app-front-service` | `closedelivery-destination-service` | `closedelivery-xsuaa-service` |
| `createshipmentecc` | `createshipmentecc-app-front-service` | `createshipmentecc-destination-service` | `createshipmentecc-xsuaa-service` |
| `createshipmentewm` | `createshipmentewm-app-front-service` | `createshipmentewm-destination-service` | `createshipmentewm-xsuaa-service` |
| `createshipmentv2ewm` | `createshipmentv2ewm-app-front-service` | `createshipmentv2ewm-destination-service` | `createshipmentv2ewm-xsuaa-service` |
| `dispute` | `dispute-app-front-service` | `dispute-destination-service` | `dispute-xsuaa-service` |
| `freightaudit` | `freightaudit-app-front-service` | `freightaudit-destination-service` | `freightaudit-xsuaa-service` |
| `freightauditupload` | `freightauditupload-app-front-service` | `freightauditupload-destination-service` | `freightauditupload-xsuaa-service` |
| `freightorderplanning` | `freightorderplanning-app-front-service` | `freightorderplanning-destination-service` | `freightorderplanning-xsuaa-service` |
| `ltlplanning` | `ltlplanning-app-front-service` | `ltlplanning-destination-service` | `ltlplanning-xsuaa-service` |
| `manualshipmentecc` | `manualshipmentecc-app-front-service` | `manualshipmentecc-destination-service` | `manualshipmentecc-xsuaa-service` |
| `manualshipmentewm` | `manualshipmentewm-app-front-service` | `manualshipmentewm-destination-service` | `manualshipmentewm-xsuaa-service` |
| `planshipment` | `planshipment-app-front-service` | `planshipment-destination-service` | `planshipment-xsuaa-service` |
| `quickpackecc` | `quickpackecc-app-front-service` | `quickpackecc-destination-service` | `quickpackecc-xsuaa-service` |
| `quickpackewm` | `quickpackewm-app-front-service` | `quickpackewm-destination-service` | `quickpackewm-xsuaa-service` |
| `requestforpickup` | `requestforpickup-app-front-service` | `requestforpickup-destination-service` | `requestforpickup-xsuaa-service` |
| `saleorder` | `saleorder-app-front-service` | `saleorder-destination-service` | `saleorder-xsuaa-service` |
| `shippingdashboard` | `shippingdashboard-app-front-service` | `shippingdashboard-destination-service` | `shippingdashboard-xsuaa-service` |
| `submitacefiling` | `submitacefiling-app-front-service` | `submitacefiling-destination-service` | `submitacefiling-xsuaa-service` |
| `trackshipmentecc` | `trackshipmentecc-app-front-service` | `trackshipmentecc-destination-service` | `trackshipmentecc-xsuaa-service` |
| `trackshipmentewm` | `trackshipmentewm-app-front-service` | `trackshipmentewm-destination-service` | `trackshipmentewm-xsuaa-service` |
| `viewacefiling` | `viewacefiling-app-front-service` | `viewacefiling-destination-service` | `viewacefiling-xsuaa-service` |
| `cancelacefilingsls` | `cancelacefilingsls-app-front-service` | `cancelacefilingsls-destination-service` | `cancelacefilingsls-xsuaa-service` |
| `cancelpickuprequestsls` | `cancelpickuprequestsls-app-front-service` | `cancelpickuprequestsls-destination-service` | `cancelpickuprequestsls-xsuaa-service` |
| `cancelshipmenteccsls` | `cancelshipmenteccsls-app-front-service` | `cancelshipmenteccsls-destination-service` | `cancelshipmenteccsls-xsuaa-service` |
| `cancelshipmentewmsls` | `cancelshipmentewmsls-app-front-service` | `cancelshipmentewmsls-destination-service` | `cancelshipmentewmsls-xsuaa-service` |
| `carrierperformancereporteccsls` | `carrierperformancereporteccsls-app-front-service` | `carrierperformancereporteccsls-destination-service` | `carrierperformancereporteccsls-xsuaa-service` |
| `carrierperformancereportewmsls` | `carrierperformancereportewmsls-app-front-service` | `carrierperformancereportewmsls-destination-service` | `carrierperformancereportewmsls-xsuaa-service` |
| `closedeliverysls` | `closedeliverysls-app-front-service` | `closedeliverysls-destination-service` | `closedeliverysls-xsuaa-service` |
| `createshipmenteccsls` | `createshipmenteccsls-app-front-service` | `createshipmenteccsls-destination-service` | `createshipmenteccsls-xsuaa-service` |
| `createshipmentewmsls` | `createshipmentewmsls-app-front-service` | `createshipmentewmsls-destination-service` | `createshipmentewmsls-xsuaa-service` |
| `createshipmentv2ewmsls` | `createshipmentv2ewmsls-app-front-service` | `createshipmentv2ewmsls-destination-service` | `createshipmentv2ewmsls-xsuaa-service` |
| `disputesls` | `disputesls-app-front-service` | `disputesls-destination-service` | `disputesls-xsuaa-service` |
| `freightauditsls` | `freightauditsls-app-front-service` | `freightauditsls-destination-service` | `freightauditsls-xsuaa-service` |
| `freightaudituploadsls` | `freightaudituploadsls-app-front-service` | `freightaudituploadsls-destination-service` | `freightaudituploadsls-xsuaa-service` |
| `freightorderplanningsls` | `freightorderplanningsls-app-front-service` | `freightorderplanningsls-destination-service` | `freightorderplanningsls-xsuaa-service` |
| `ltlplanningsls` | `ltlplanningsls-app-front-service` | `ltlplanningsls-destination-service` | `ltlplanningsls-xsuaa-service` |
| `manualshipmenteccsls` | `manualshipmenteccsls-app-front-service` | `manualshipmenteccsls-destination-service` | `manualshipmenteccsls-xsuaa-service` |
| `manualshipmentewmsls` | `manualshipmentewmsls-app-front-service` | `manualshipmentewmsls-destination-service` | `manualshipmentewmsls-xsuaa-service` |
| `planshipmentsls` | `planshipmentsls-app-front-service` | `planshipmentsls-destination-service` | `planshipmentsls-xsuaa-service` |
| `quickpackeccsls` | `quickpackeccsls-app-front-service` | `quickpackeccsls-destination-service` | `quickpackeccsls-xsuaa-service` |
| `quickpackewmsls` | `quickpackewmsls-app-front-service` | `quickpackewmsls-destination-service` | `quickpackewmsls-xsuaa-service` |
| `requestforpickupsls` | `requestforpickupsls-app-front-service` | `requestforpickupsls-destination-service` | `requestforpickupsls-xsuaa-service` |
| `saleordersls` | `saleordersls-app-front-service` | `saleordersls-destination-service` | `saleordersls-xsuaa-service` |
| `shippingdashboardsls` | `shippingdashboardsls-app-front-service` | `shippingdashboardsls-destination-service` | `shippingdashboardsls-xsuaa-service` |
| `submitacefilingsls` | `submitacefilingsls-app-front-service` | `submitacefilingsls-destination-service` | `submitacefilingsls-xsuaa-service` |
| `trackshipmenteccsls` | `trackshipmenteccsls-app-front-service` | `trackshipmenteccsls-destination-service` | `trackshipmenteccsls-xsuaa-service` |
| `trackshipmentewmsls` | `trackshipmentewmsls-app-front-service` | `trackshipmentewmsls-destination-service` | `trackshipmentewmsls-xsuaa-service` |
| `viewacefilingsls` | `viewacefilingsls-app-front-service` | `viewacefilingsls-destination-service` | `viewacefilingsls-xsuaa-service` |
| `cancelhd6` | `cancelhd6-app-front-service` | `cancelhd6-destination-service` | `cancelhd6-xsuaa-service` |
| `disputehd6` | `disputehd6-app-front-service` | `disputehd6-destination-service` | `disputehd6-xsuaa-service` |
| `eodhd6` | `eodhd6-app-front-service` | `eodhd6-destination-service` | `eodhd6-xsuaa-service` |
| `farpthd6` | `farpthd6-app-front-service` | `farpthd6-destination-service` | `farpthd6-xsuaa-service` |
| `freightaudithd6` | `freightaudithd6-app-front-service` | `freightaudithd6-destination-service` | `freightaudithd6-xsuaa-service` |
| `parceldemohd6` | `parceldemohd6-app-front-service` | `parceldemohd6-destination-service` | `parceldemohd6-xsuaa-service` |
| `parcelhd6` | `parcelhd6-app-front-service` | `parcelhd6-destination-service` | `parcelhd6-xsuaa-service` |
| `trackshipmenthd6` | `trackshipmenthd6-app-front-service` | `trackshipmenthd6-destination-service` | `trackshipmenthd6-xsuaa-service` |

## Reproduction

Regenerate this snapshot at any time:

```bash
python scripts/dump-btp-cf-cc-snapshot.py
```

Requires `cf` logged in to the correct org/space, network reachability to `destination-configuration.cfapps.us11.hana.ondemand.com`, and the per-app destination-content service keys (present by default after MTA deploy).

Snapshot generated: 2026-06-11T09:37:54.949762Z
