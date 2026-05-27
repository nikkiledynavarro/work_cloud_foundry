function initModel() {
	var sUrl = "/sap/opu/odata/serperp/SHIP_DASH_SRV/";
	var oModel = new sap.ui.model.odata.ODataModel(sUrl, true);
	sap.ui.getCore().setModel(oModel);
}