/*global location*/
jQuery.sap.require("com.erpis.shiperp.sls.trackshipmentsls.common.jquery_hotkeys");
sap.ui.define([
	"com/erpis/shiperp/sls/trackshipmentsls/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/sls/trackshipmentsls/model/formatter",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"com/erpis/shiperp/sls/trackshipmentsls/common/Utils",
	"com/erpis/shiperp/sls/trackshipmentsls/common/hotkeyInterface"
], function (BaseController, JSONModel, formatter, Token, Filter, MessageBox, MessageToast, Utils, HotkeyInterface) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.trackshipmentsls.controller.ECC.Main", {

		_oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.sls.trackshipmentsls.controller.ECC.Main"),
		formatter: formatter,
		oBundle: null, // i18n bundle class
		// Commonly used controller attributes
		sProfile: "", // Shipping profile
		sStation: "", // Shipping station
		sInputID: "", // Input ID
		sInputType: "", // Input Type

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				Shipments: []
			});
			this.setModel(oViewModel, "local");
			var oModel = new JSONModel({
				modelData: []
			});
			this.getView().setModel(oModel, "pageModel");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			var iStart = window.location.href.indexOf("?trackno=");
			var iEnd = window.location.href.lastIndexOf("&");
			var sTrackno = "";
			if (iEnd !== -1 && iStart !== -1) {
				sTrackno = window.location.href.slice(iStart + "?trackno=".length, iEnd);
			}

			if (sTrackno) {
				this.byId("cbInputType").setSelectedKey("7"); //Tracking Number
				this.byId("txtIdECC").setValue(sTrackno);
				this.byId("txtIdECC").fireSubmit();
			}
			this.hideBusy();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onSubmit: function (oEvent) {
			if (this.byId("cbInputType").getSelectedKey() !== "") {
				this.sInputType = this.byId("cbInputType").getSelectedKey();
				this.byId("cbInputType").setValueState("None");
			} else {
				MessageBox.error(this.oBundle.getText("missingInputType"));
				this.byId("cbInputType").setValueState("Error");
				return;
			}

			if (oEvent.getSource().getValue() === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("txtIdECC").setValueState("Error");
				return;
			} else {
				this.byId("txtIdECC").setValueState("None");
			}

			this.sInputID = oEvent.getSource().getValue();
			this.showBusy();
			var oRequestData = this._generateGetTrackDataUsecase();
			this.getModel().create("/TrackShipmentReturnSet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/TrackData", oData.TrackShipmentNew.results);
					this.getModel("local").setProperty("/TrackReply", oData.TrackReply.results);
					if (oData.TrackShipmentNew) {
						this.getModel("local").setProperty("/Shipments", oData.TrackShipmentNew.results);
						var oPageModel = this.getView().getModel("pageModel");
						var nTotalItems = (oData.TrackShipmentNew.results).length;
						this.hideBusy();
						var aListEntries = [];
						if (nTotalItems > 0) {
							this.getModel("local").setProperty("/showPagination", true);
							for (var i = 0; i < nTotalItems; i++) {
								aListEntries.push(i + 1);
							}
							this.getModel("pageModel").setProperty("/modelData", aListEntries);
							if (nTotalItems > 100) {
								oPageModel.setSizeLimit(aListEntries);
							}
							//pagination button
							var iNumSelect = 10;
							if (nTotalItems < 10) {
								iNumSelect = nTotalItems;
							}
							var nTotal = Math.ceil(nTotalItems / iNumSelect);
							this.getModel("local").setProperty("/Pagination", {
								ncurrNum: 1,
								nPage: iNumSelect,
								Total: nTotal
							});
							var aFinalData = [];
							aFinalData = this.handlePagination(oData.TrackShipmentNew.results, iNumSelect, 1);
							this.getModel("local").setProperty("/ShipmentFinalData", aFinalData);
						}
						this.hideBusy();
					}
					if (oData.ReturnSet && oData.ReturnSet.results.length > 0) {
						var aMsg = this._generateMessages(oData.ReturnSet.results);
						this._addMessage(aMsg);
					}
					this.byId("idShipmentDetail").removeSelections();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/Shipments", []);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
			// this.getModel().callFunction("/TrackShipmentReturnSet", {
			// 	method: "POST",
			// 	urlParameters: {
			// 		Profile: this.sProfile,
			// 		Station: this.sStation,
			// 		InputType: this.sInputType,
			// 		InputId: this.sInputID,
			// 		TrackShipment : [],
			// 		TrackReply: [],
			// 		TrackShipmentNew: []
			// 	},
			// 	success: function (oData) {
			// 		var aOutput = [];
			// 		aOutput = this.treeify(oData.results);
			// 		this.getModel("local").setProperty("/Shipments", aOutput);
			// 		this.hideBusy();
			// 	}.bind(this),
			// 	error: function (oError) {
			// 		this.getModel("local").setProperty("/Shipments", []);
			// 		this._handleODataError(oError);
			// 		this.hideBusy();
			// 	}.bind(this)
			// });
		},

		_generateGetTrackDataUsecase: function () {
			var oData = {
				Profile: this.sProfile,
				Station: this.sStation,
				InputType: this.sInputType,
				InputId: this.sInputID,
				TrackReply: [],
				TrackShipmentNew: []
			};
			return oData;
		},

		onResetData: function () {
			this.byId("txtIdECC").setValue("");
			this.getModel("local").setData({
				Shipments: []
			});
			this.getModel("pageModel").setProperty("/modelData", []);
		},

		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");
			if (!shellHash) {
				return;
			}
			this._setCookie("AppCancel", "ECC");
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		},

		onPrintPODDetail: function () {
			var aTrackStatus = this.getModel("local").getProperty("/ShipmentsStatus");
			if (aTrackStatus && aTrackStatus.length > 0) {
				this._getPoD(aTrackStatus[0].Tracknum);
			}
		},

		/**
		 * (+) convert change UI for 
		 * Modified by: Michael Ha
		 * Modified at: 15/09/2022
		 */
		// onRowSelectionChange: function (oEvent) {
		// 	var oTab = oEvent.getSource();
		// 	var aIndices = oTab.getSelectedIndices();
		// 	var bFlag = false;
		// 	// Check if any freight unit has tracking number
		// 	aIndices.forEach(function (itemIndex) {
		// 		var oItem = oTab.getRows()[itemIndex];
		// 		var oData = oItem.getBindingContext("local").getObject();
		// 		if (oData.Trackingnum === "") {
		// 			oTab.removeSelectionInterval(itemIndex, itemIndex);
		// 			bFlag = true;
		// 		}
		// 	});
		// 	if (bFlag) {
		// 		MessageBox.warning(this.oBundle.getText("invalidSelection"));
		// 	}
		// },

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		/**
		 * (+) Fix print 
		 * Modified by: Michael Ha
		 * Modified at: 17/09/2022
		 */
		_getPoD: function (oData) {
			this.showBusy();
			var sTrackno = oData;
			this.getModel().callFunction("/GetPODPrint", {
				"method": "GET",
				urlParameters: {
					Station: this.sStation,
					Profile: this.sProfile,
					TrackNo: sTrackno,
				},
				success: function (oData) {
					var contentType;
					var blob;
					var fileURL;
					if (oData.results.length > 0) {
						for (var i = 0; i < oData.results.length; i++) {
							if (oData.results[i].Podtype === "BIN") {
								var convString = this.hexToBase64(oData.results[i].Strpod);
								var b64Data = convString;
								contentType = 'application/pdf';
								blob = this.b64toBlob(b64Data, contentType);
								fileURL = URL.createObjectURL(blob);
								window.open(fileURL);
							} else if (oData.results[i].Podtype === "HTML") {
								contentType = "text/html";
								blob = this.b64toBlob(oData.results[i].Strpod, contentType);
								fileURL = URL.createObjectURL(blob);
								window.open(fileURL);
							}
							 else if (oData.results[i].Podtype === "GIF") {
								contentType = 'image/gif';
								blob = this.b64toBlob(oData.results[i].Strpod, contentType);
								fileURL = URL.createObjectURL(blob);
								window.open(fileURL);
							}
						}
					}

					this.hideBusy();
				}.bind(this),
				// success: function (oData) {
				// 	var aGuids = oData.results;
				// 	aGuids.forEach(function (item) {
				// 		var sPath = this.getModel().sServiceUrl + "/PODPrintSet(Guid='" + item.Guid + "')/$value";
				// 		sap.m.URLHelper.redirect(sPath, true);
				// 	}.bind(this));

				// 	this.hideBusy();
				// }.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		hexToBase64: function (str) {
			var bString = "";
			for (var i = 0; i < str.length; i += 2) {
				bString += String.fromCharCode(parseInt(str.substr(i, 2), 16));
			}
			return btoa(bString);
		},
		b64toBlob: function (b64Data, contentType, sliceSize) {
			contentType = contentType || '';
			sliceSize = sliceSize || 512;
			var byteCharacters = atob(b64Data);
			var byteArrays = [];
			for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				var slice = byteCharacters.slice(offset, offset + sliceSize);
				var byteNumbers = new Array(slice.length);
				for (var i = 0; i < slice.length; i++) {
					byteNumbers[i] = slice.charCodeAt(i);
				}
				var byteArray = new Uint8Array(byteNumbers);
				byteArrays.push(byteArray);
			}
			var blob = new Blob(byteArrays, {
				type: contentType
			});
			return blob;
		},

		treeify: function (list, idAttr, parentAttr, childrenAttr) {
			if (!idAttr) idAttr = "NodeId";
			if (!parentAttr) parentAttr = "ParentId";
			if (!childrenAttr) childrenAttr = "Children";

			var treeList = [];
			var lookup = {};
			list.forEach(function (obj) {
				lookup[obj[idAttr]] = obj;
				obj[childrenAttr] = [];
			});
			list.forEach(function (obj) {
				if (obj[parentAttr] !== 0) {
					lookup[obj[parentAttr]][childrenAttr].push(obj);
				} else {
					treeList.push(obj);
				}
			});
			return treeList;
		},
		/**
		 * (+) convert change UI for 
		 * Modified by: Michael Ha
		 * Modified at: 13/09/2022
		 */
		_builData: function () {
			var oDeferred = $.Deferred();
			var oRequestData = this._generateGetTrackDataUsecase();
			this.showBusy();
			this.getModel().create("/TrackShipmentReturnSet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/TrackData", oData.TrackShipmentNew.results);
					this.getModel("local").setProperty("/TrackReply", oData.TrackReply.results);
					oDeferred.resolve();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/Shipments", []);
					this._handleODataError(oError);
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		onOpenTrackingStatusDialog: function (oEvent) {
			var oDeferred = $.Deferred();
			var sText = oEvent.getSource().getBindingContext("local").getObject().TrackingNum;
			oDeferred = this._builData();
			$.when(sText, oDeferred).done(function () {
				this._handleDateForTrackData();
				var aDataTrackReply = [];
				if (sText.length > 0) {
					var aTrackReply = this.getModel("local").getProperty("/TrackReply");
					if (aTrackReply && aTrackReply.length > 0) {
						for (var i = 0; i < aTrackReply.length; i++) {
							if (sText === aTrackReply[i].Tracknum) {
								aDataTrackReply.push(aTrackReply[i]);
							}
						}
					}
				}

				if (aDataTrackReply) {
					this.getModel("local").setProperty("/ShipmentsStatus", aDataTrackReply);
					var aShipmentsStatus = [];
					aShipmentsStatus = this.getModel("local").getProperty("/ShipmentsStatus");

					this.getModel("local").setProperty("/firstObject", aShipmentsStatus[0]);
					var oModel = new JSONModel({
						shipmentDetail: []
					});
					this.getView().setModel(oModel, "modelDetail");
					var nTotalItems = (aDataTrackReply).length;
					var aListEntries = [];
					if (nTotalItems > 0) {
						this.getModel("local").setProperty("/showPaginationDetail", true);
						for (i = 0; i < nTotalItems; i++) {
							aListEntries.push(i + 1);
						}
						this.getModel("modelDetail").setProperty("/shipmentDetail", aListEntries);
						if (nTotalItems > 100) {
							oModel.setSizeLimit(aListEntries);
						}
						//pagination button
						var iNumSelect = 10;
						if (nTotalItems < 10) {
							iNumSelect = nTotalItems;
						}
						var nTotal = Math.ceil(nTotalItems / iNumSelect);
						this.getModel("local").setProperty("/PaginationDetail", {
							ncurrNum: 1,
							nPage: iNumSelect,
							Total: nTotal
						});
						var aFinalData = [];
						aFinalData = this.handlePagination(aDataTrackReply, iNumSelect, 1);
						this.getModel("local").setProperty("/ShipmentDetailFinalData", aFinalData);
					}
				}
				// if (aDataTrackReply.ReturnSet && aDataTrackReply.ReturnSet.results.length > 0) {
				// 	var aMsg = this._generateMessages(aDataTrackReply.ReturnSet.results);
				// 	this._addMessage(aMsg);
				// }
				if (!this.oTrackingStatusDialog) {
					this.oTrackingStatusDialog = Utils.getFragment("", "EWM.TrackShipmentDetail", this);
				}
				this.hideBusy();
				this.oTrackingStatusDialog.open();
			}.bind(this));

		},

		handlePagination: function (array, page_size, page_number) {
			return array.slice((page_number - 1) * page_size, page_number * page_size);
		},

		onButtonClose: function (oEvent) {
			this.oTrackingStatusDialog.close();
		},

		_handleDateForTrackData: function () {
			var aTrackData = this.getModel("local").getProperty("/TrackReply");
			if (aTrackData && aTrackData.length > 0) {
				for (var i = 0; i < aTrackData.length; i++) {
					if (aTrackData[i].Datum !== null) {
						aTrackData[i].Datum = [aTrackData[i].Datum.slice(0, 4), "-", aTrackData[i].Datum.slice(4, 6), "-", aTrackData[i].Datum.slice(6,
							8)].join(
							'');
					}
					if (aTrackData[i].Deliverydate !== null) {
						var day = String(aTrackData[i].Deliverydate.getDate()).padStart(2, "0");
						var month = String(aTrackData[i].Deliverydate.getMonth() + 1).padStart(2, "0");
						var year = aTrackData[i].Deliverydate.getFullYear();
						var formattedDay = year + "-" + month + "-" + day;
						aTrackData[i].Deliverydate = formattedDay;
					}
				}
			}
			return aTrackData;
		},

		onNavBackButtonPress: function () {
			this._handleNavButton("Back");
		},

		onNavNextButtonPress: function () {
			this._handleNavButton("Next");
		},

		_handleNavButton: function (sAction) {
			var sPageSize = this.byId("numSelected").getSelectedKey();
			var PageNum = this.getModel("local").getProperty("/Pagination/ncurrNum");
			var aDataCurr = this.getModel("local").getProperty("/Shipments");
			var aFinalData = [];
			if (sAction) {
				if (sAction === "Back") {
					PageNum--;
				} else {
					PageNum++;
				}
				this.getModel("local").setProperty("/Pagination/ncurrNum", PageNum);
				aFinalData = this.handlePagination(aDataCurr, parseInt(sPageSize, 10), PageNum);
			} else {
				var nTotal = Math.ceil(aDataCurr.length / parseInt(sPageSize, 10));
				this.getModel("local").setProperty("/Pagination", {
					ncurrNum: 1,
					nPage: parseInt(sPageSize, 10),
					Total: nTotal
				});
				aFinalData = this.handlePagination(aDataCurr, parseInt(sPageSize, 10), 1);
			}
			this.getModel("local").setProperty("/ShipmentFinalData", aFinalData);
		},

		onPrintPOD: function () {
			var aSelectedTrackNum = this.byId("idShipmentDetail").getSelectedItems();
			if (aSelectedTrackNum.length !== 1) {
				MessageBox.warning(this.oBundle.getText("warningSelectOneItem"));
				return;
			}
			var sTracknum = aSelectedTrackNum[0].getBindingContext("local").getObject().TrackingNum;
			this._getPoD(sTracknum);
		},

		_generatePODUsecase: function (sTrackno) {
				var oData = {
					inputids: (this.sInputID) ? this.sInputID : "",
					inputtype: (this.sInputType) ? this.sInputType : "",
					profile: (this.sProfile) ? this.sProfile : "",
					warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
					shippingstation: (this.sStation) ? this.sStation : "",
					action: "POD",
					ReturnSet: [],
					trackingnum: sTrackno,
					ShipDataSet: [],
					pod: "",
					pod_type: "",
					pod2: "",
					pod2_type: ""
				};
				return oData;
			}
			// end
	});
});