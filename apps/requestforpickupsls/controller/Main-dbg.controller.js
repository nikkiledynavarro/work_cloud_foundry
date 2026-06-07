sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/requestforpickup/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/requestforpickup/model/formatter",
	"com/erpis/shiperp/hr7/requestforpickup/common/Utils",
	"com/erpis/shiperp/hr7/requestforpickup/common/DynamicView",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/m/Token"
], function (library, BaseController, JSONModel, formatter, Utils, DynamicView, MessageBox, Filter, Token) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.requestforpickup.controller.Main", {

		oBundle: null,
		formatter: formatter,

		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			this.setModel(new JSONModel({}), "local");

			// Initialize Message Model
			var oModelMessage = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oModelMessage, "messageModel");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 **/
		_onObjectMatched: function (oEvent) {
			this.oTotal = {
				totalPieces: 0,
				totalPallets: 0,
				totalWeight: 0
			};
			this.sInputType = this.byId("idInputType").getSelectedKey();
			this.byId("iconTabCarMoreOpt").setVisible(false);
			this.getModel("local").setProperty("/EnabledButton", false);
			this.getModel("local").setProperty("/total", this.oTotal);
			if (this.sInputType === "Manual") {
				this.getModel("local").setProperty("/ShipmentManual", true);
				this.getModel("local").setProperty("/SCanNumber", true);
			} else {
				// Mandatory field if “Delivery” or “Shipment Document” is selected
				this.getModel("local").setProperty("/Mandatory", this.sInputType);
				// Enabled field if “Delivery” or “Shipment Document” is selected
				this.getModel("local").setProperty("/ShipmentManual", false);
				this.getModel("local").setProperty("/SCanNumber", false);
			}
			// var oDeferredAll = this._getBindingCDSViews();
			// oDeferredAll.done(function () {
			// 	this.hideBusy();
			// }.bind(this));

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		_getRfp: function (sInputType) {
			var Deferred = $.Deferred();
			this.sInputType = this.byId("idInputType").getSelectedKey();
			var sPath = "/RequestForPickupQuerySet";
			this.getModel().read(sPath, {
				urlParameters: {
					"$expand": "packageDetails,carrierMoreOption/valueList,return"
				},
				filters: [
					new Filter("inputType", "EQ", sInputType),
				],
				success: function (oData) {
					var oResultData = oData.results[0];
					if (oData.results.length > 0) {
						this.getModel("local").setProperty("/basic", oResultData.basic);
						this.getModel("local").setProperty("/total", oResultData.totals);
						this.getModel("local").setProperty("/PackageDetails", oResultData.packageDetails.results);
						if (oResultData.carrierMoreOption.results.length > 0) {
							this.getModel("local").setProperty("/ShipmentCarrierOptions", oResultData.carrierMoreOption.results);
							this._displayShipmentCarrierMoreOptTab();
						}
					}
					Deferred.resolve();
				}.bind(this),
				error: function (oError) {
					Deferred.resolve();
					this.hideBusy();
				}.bind(this)
			})
			return Deferred;
		},

		onChangeInputType: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			// Mandatory field if “Delivery” or “Shipment Document” is selected
			this.getModel("local").setProperty("/Mandatory", sSelectedKey);
			if (sSelectedKey === "Manual") {
				this._getRfp(this.sInputType).done(function () {
					this.byId("txtId").setValue("");
					this.byId("txtId").setEditable(false);
					this.getModel("local").setProperty("/total", this.oTotal);
					this.getModel("local").setProperty("/ShipmentManual", true);
					this.getModel("local").setProperty("/SCanNumber", true);
					this.hideBusy();
				}.bind(this));
			} else {
				this.byId("txtId").setEditable(true);
				// Enabled field if “Delivery” or “Shipment Document” is selected
				this.getModel("local").setProperty("/ShipmentManual", false);
				this.getModel("local").setProperty("/SCanNumber", false);
			}
		},

		onScanDocNumber: function () {
			this.byId("idInputType").setEditable(false);
			this.byId("txtId").setEditable(false);
			this.sInputIds = this.byId("txtId").getValue();
			this.sInputType = this.byId("idInputType").getSelectedKey();
			if (this.sInputIds === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("idInputType").setEditable(true);
				this.byId("txtId").setEditable(true);
				this.byId("txtId").setValueState("Error");
				this.hideBusy();
				return;
			} else {
				this.byId("txtId").setValueState("None");
			}

			var sPath = "/RequestForPickupQuerySet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: [
					new Filter("inputIDs", "EQ", this.sInputIds),
					new Filter("inputType", "EQ", this.sInputType),
				],
				urlParameters: {
					"$expand": "packageDetails,carrierMoreOption/valueList,return,multiDeliveries/deliveries"
				},
				success: function (oData) {
					var oResultData = oData.results[0];
					if (oData.results.length > 0) {
						if (oResultData.multiDeliveries.showMultiDeliv) {
							this.getModel("local").setProperty("/aDeliveriesList", oResultData.multiDeliveries.deliveries.results);
							if (!this.oDeliveriesDialog) {
								this.oDeliveriesDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.requestforpickup.fragment.MutipleDeliveriesDialog",
									this);
								this.getView().addDependent(this.oDeliveriesDialog);
							}
							this.oDeliveriesDialog.open();
							sap.ui.getCore().byId("idDeliveries").removeSelections();
							this.hideBusy();
						};
						this.getModel("local").setProperty("/basic", oResultData.basic);
						this.getModel("local").setProperty("/total", oResultData.totals);
						this.getModel("local").setProperty("/PackageDetails", oResultData.packageDetails.results);
						// Enabled field 
						this.getModel("local").setProperty("/ShipmentManual", true);
						this.getModel("local").setProperty("/SCanNumber", false);
						if (oResultData.carrierMoreOption.results.length > 0) {
							this.getModel("local").setProperty("/ShipmentCarrierOptions", oResultData.carrierMoreOption.results);
							this._displayShipmentCarrierMoreOptTab();
						}
					};
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onConsolidation: function () {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			//open dialog
			this._consolidationDialog = Utils.getFragment(null, "Consolidation.DocumentNumbers", this);
			this._consolidationDialog.open();
		},

		onCancel: function () {
			this._consolidationDialog.close();
		},

		// Reset button click
		onResetData: function () {
			// this.showBusy();
			this.byId("ObjectPageLayout").scrollToSection(this.byId("idInputType").getId());
			setTimeout(this._resetData.bind(this), 1000); //eslint-disable-line
		},

		// Reset whole screen data
		_resetData: function () {
			// consolidation 
			var aDocNumber = [];
			var oBindingId = this.byId("idDocNo");
			if (oBindingId) {
				aDocNumber = oBindingId.getTokens();
			}
			var sSelectedKey = this.byId("idInputType").getSelectedKey();
			if (aDocNumber.length > 0) {
				this.byId("idDocNo").removeAllTokens();
			}
			// document number
			this.byId("txtId").setValue("");
			this.byId("idInputType").setEditable(true);
			this.byId("iconTabCarMoreOpt").setVisible(false);
			// reset data model
			this.getModel("local").setData({});
			this.byId("ObjectPageLayout").setShowHeaderContent(false);
			this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(false);
			if (sSelectedKey === "Manual") {
				this._getRfp(this.sInputType).done(function () {
					this.byId("txtId").setEditable(false);
					this.getModel("local").setProperty("/ShipmentManual", true);
					this.getModel("local").setProperty("/SCanNumber", true);
					this.getModel("local").setProperty("/total", this.oTotal);
					this.hideBusy();
				}.bind(this));
			} else {
				this.byId("txtId").setEditable(true);
				// Mandatory field if “Delivery” or “Shipment Document” is selected
				this.getModel("local").setProperty("/Mandatory", this.sInputType);
				// Enabled field if “Delivery” or “Shipment Document” is selected
				this.getModel("local").setProperty("/ShipmentManual", false);
				this.getModel("local").setProperty("/SCanNumber", false);
			}
			this.hideBusy();
		},

		onMultiInputDocNo: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var sNewValue = oMultiInput.getValue();

			if (sNewValue) {
				var oToken = new sap.m.Token({
					key: sNewValue,
					text: sNewValue
				});
				oMultiInput.addToken(oToken);
				oMultiInput.setValue("");
			}
		},

		_checkRequiredRfp: function (Value, fieldIds) {
			var hasError = false;
			for (var key in Value) {
				if (Value.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (Value[key] === "" || Value[key] === null) {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else if (key === 'pickupTime') {
						var sPickupTime = this.byId("idPickupTime").getValue();
						if (sPickupTime === '00:00:00') {
							this.byId(fieldIds[key]).setValueState("Error");
							hasError = true;
						} else {
							this.byId(fieldIds[key]).setValueState("None");
						}
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}
			return !hasError;
		},

		onSubmitRFP: function () {
			var fieldIds = {
				carrier: "idCarrierCode",
				pickupDate: "idPickupDate",
				pickupTime: "idPickupTime",
				pickupTime: "idPickupTime",
				dockOpenTime: "idOpenTime",
				doorCloseTime: "idCloseTime"
			};
			var oValue = this.getModel("local").getProperty("/basic");
			var bRequired = this._checkRequiredRfp(oValue.pickup_details, fieldIds);
			if (bRequired) {
				this.showBusy();
				var oRequestPayload = this.generateRFPPayload(oValue, fieldIds);
				this.getModel().create("/RequestForPickupQuerySet", oRequestPayload, {
					success: function (oData) {
						if (oData.return && oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		generateRFPPayload: function (oValue, fieldIds) {
			this.getModel("local").setProperty("/data", jQuery.extend(true, {}, oValue));
			var timeFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "'PT'HH'H'mm'M'ss'S'"
			});
			var aPackageDetails = this.getModel("local").getProperty("/PackageDetails");
			this.sInputType = this.byId("idInputType").getSelectedKey();
			for (var key in oValue.pickup_details) {
				if (key === 'pickupTime' || key === 'dockOpenTime' || key === 'doorCloseTime') {
					this.getModel("local").setProperty("/data/pickup_details/" + key, timeFormat.format(this.byId(fieldIds[key]).getDateValue()));
				}
			};
			var oPayload = {
				inputIDs: this.sInputIds,
				inputType: this.sInputType,
				basic: this.getModel("local").getProperty("/data"),
				documentNumber: "",
				packageDetails: (aPackageDetails) ? aPackageDetails : [],
				action: "RequestForPickupProcess",
				return: []
			};
			return oPayload;
		},

		onSubmitDocumentNo: function (oEvent) {
			var sDocumentNumber = "";
			var aValue = this.byId("idDocNo").getTokens();
			if (aValue.length > 0) {
				for (var i = 0; i < aValue.length; i++) {
					var sTokenValue = aValue[i].getText();
					sDocumentNumber += sTokenValue + ",";
				}
			} else {
				MessageBox.error(this.oBundle.getText("submitDocNo"));
				return;
			}
			// Enable inputs fields
			var sSelectedKey = this.byId("idInputType").getSelectedKey();
			if (sSelectedKey === "Manual") {
				this.byId("txtId").setEditable(true);
			} else {
				this.byId("txtId").setValue("MULTIPLE");
				this.byId("txtId").setEditable(false);
			}
			this.showBusy();
			var oRequestPayload = this.generatePayload(sDocumentNumber);
			this.getModel().create("/RequestForPickupQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						// Enabled field 
						this.getModel("local").setProperty("/ShipmentManual", true);
						this.getModel("local").setProperty("/SCanNumber", false);
						this.getModel("local").setProperty("/basic", oData.basic);
						this._consolidationDialog.close();
					}
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generatePayload: function (sDocumentNumber) {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			var oPayload = {
				inputIDs: this.byId("txtId").getValue(),
				inputType: this.sInputType,
				basic: this.getModel("local").getProperty("/basic"),
				documentNumber: sDocumentNumber,
				packageDetails: [],
				action: "RequestForPickupConsolidate",
				return: []
			};
			return oPayload;
		},

		onChangeCarrier: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			// filter Carrier
			if (sSelectedKey) {
				var oFilter = new sap.ui.model.Filter("CarrierCode", sap.ui.model.FilterOperator.Contains, sSelectedKey);
				this.byId("idService").getBinding("items").filter([oFilter]);
			} else {
				this.byId("idService").getBinding("items").filter([]);
			}

			this.showBusy();
			var oRequestPayload = this.generateCarrierPayload(sSelectedKey);
			this.getModel().create("/RequestForPickupQuerySet", oRequestPayload, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic", oData.basic);
					if (oData.carrierMoreOption.results.length > 0) {
						this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.carrierMoreOption.results);
					} else {
						this.getModel("local").setProperty("/ShipmentCarrierOptions", []);
					}
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this._displayShipmentCarrierMoreOptTab();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateCarrierPayload: function (sCarrier) {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			var oPayload = {
				carrier: sCarrier,
				inputIDs: this.sInputIds,
				inputType: this.sInputType,
				basic: this.getModel("local").getProperty("/basic"),
				carrierMoreOption: [{
					valueList: []
				}],
				documentNumber: "",
				action: "RequestForPickupChangeCarrier",
				return: []
			};
			return oPayload;
		},

		onChangeService: function (oEvent) {
			var oSeletedItem = oEvent.getSource().getSelectedItem();
			if (oSeletedItem) {
				var sSelected = oSeletedItem.getBindingContext().getObject().CarrierCode;
				this.byId("idCarrierCode").setSelectedKey(sSelected);
			} else {
				this.byId("idCarrierCode").setSelectedKey("");
			}
		},

		onChangeCountry: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			// filter Region
			if (sSelectedKey) {
				var oFilter = new sap.ui.model.Filter("Bezei", sap.ui.model.FilterOperator.Contains, sSelectedKey);
				this.byId("Region").getBinding("items").filter([oFilter]);
			} else {
				this.byId("Region").getBinding("items").filter([]);
			}
		},

		onChangeRegion: function (oEvent) {
			var oSeletedItem = oEvent.getSource().getSelectedItem()
			if (oSeletedItem) {
				var sSelected = oSeletedItem.getBindingContext().getObject().Land1;
				this.byId("Country").setSelectedKey(sSelected);
			} else {
				this.byId("Country").setSelectedKey("");
			}
		},

		changePickupCountry: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			// filter Region
			if (sSelectedKey) {
				var oFilter = new sap.ui.model.Filter("Bezei", sap.ui.model.FilterOperator.Contains, sSelectedKey);
				this.byId("").getBinding("items").filter([oFilter]);
			} else {
				this.byId("RfpRegion").getBinding("items").filter([]);
			}
		},

		onChangePickupRegion: function (oEvent) {
			var oSeletedItem = oEvent.getSource().getSelectedItem()
			if (oSeletedItem) {
				var sSelected = oSeletedItem.getBindingContext().getObject().Land1;
				this.byId("RfpCountry").setSelectedKey(sSelected);
			} else {
				this.byId("RfpCountry").setSelectedKey("");
			}
		},
		onCrossNavigateCancelPR: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		// =============================== Carrier more option ============================
		_displayShipmentCarrierMoreOptTab: function () {
			//Display carrier more option dynamic
			var aCarrierMoreOptions = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			if (aCarrierMoreOptions && aCarrierMoreOptions.length > 0) {
				var aDataFixed = this._checkDuplicateObjInArr(aCarrierMoreOptions, "objectName");
				this.getModel("local").setProperty("/ShipmentCarrierOptions", aDataFixed);
				// Carrier specific Tab
				this.oShipmentCarrierOptionTab = this.byId("iconTabCarMoreOptSub");
				this.byId("iconTabCarMoreOpt").setVisible(true);
				this.oShipmentCarrierOptionTab.setTitle(this.getModel("local").getProperty("/basic/pickup_details/carrier"));
				this._generateShipmentCarrierMoreOption(aCarrierMoreOptions, this.oShipmentCarrierOptionTab);
			} else {
				this.byId("iconTabCarMoreOpt").setVisible(false);
			}
		},
		/**
		 * Remove Dublicate value of objectName in array
		 * @param: aSource
		 * @param: sObject - value to check duplicate
		 * @return unique array
		 * @last modified: Michael 04/12/2024
		 * */
		_checkDuplicateObjInArr: function (aSource, sObject) {
			var oValueKey = {};
			// Count occurrences of each objectName
			for (var i = 0, len = aSource.length; i < len; i++) {
				var objectName = aSource[i][sObject];
				if (aSource[i].objectName !== "") {
					if (oValueKey[objectName] === undefined) {
						oValueKey[objectName] = 1;
					} else {
						oValueKey[objectName]++;
					}
				}
			}
			// Get objects_names with occurrences greater than 1
			for (var key in oValueKey) {
				if (oValueKey[key] > 1) {
					var found = aSource.find(function (item) {
						return item.objectName === key && item.valueList.results.length > 0;
					});
					for (var j = 0; j < aSource.length; j++) {
						if (found) {
							if (aSource[j].objectName === key && aSource[j].valueList.results.length === 0) {
								aSource[j].valueList = found.valueList;
							}
						}

					}
				}
			}
			return aSource;
		},
		_generateShipmentCarrierMoreOption: function (aShipmentCarrierMoreOptions, oContainer) {
			this.oShipmentCarrierOptionTab = oContainer;
			//resset shipment
			if (this.oShipmentCarrierOptionTab.getBlocks()[0] instanceof sap.m.FlexBox) {
				if (this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
					this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0].removeAllContent();
				} else {
					this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[1].removeAllItems();
				}
			} else {
				var oCurrForm = this.oShipmentCarrierOptionTab.getBlocks()[0];
				if (oCurrForm) {
					oCurrForm.removeAllContent();
				}
			}
			this.oShipmentCarrierOptionTab.removeAllBlocks();
			//add prefix before process
			var aShipmentFields = Utils._addPrefixToFieldName(aShipmentCarrierMoreOptions, "SHIPMENT_");
			DynamicView.renderShipmentCarrierOptionForm(aShipmentFields, this, false);
		},

		//--- Add Package Details --------------------- 
		onAddPress: function (oEvent) {
			var oData = {
				packingMaterial: "",
				palletCount: "",
				pieceCount: "",
				weight: "",
				weightUoM: "",
				length: "",
				width: "",
				height: "",
				dimensionsUoM: "",
			};
			this._oAddPackageDetails = Utils.getFragment(null, "Package.CuPackageDetails", this);
			this.byId("PkgDels").setTitle("Add Package Details")
			this._oAddPackageDetails.setModel(new JSONModel(oData), "local");
			this.getModel("local").setProperty("/PKDCUD", true);
			this._getUoM();
			this._oAddPackageDetails.open();
		},

		//--- Edit Package Details --------------------- 
		onEditPress: function (oEvent) {
			var SelectedItem = this.byId("packageDetails").getSelectedItem().getBindingContext("local").getObject();
			this._oEditPackageDetails = Utils.getFragment(null, "Package.CuPackageDetails", this);
			this._oEditPackageDetails.setModel(new JSONModel(SelectedItem), "local");
			this.getModel("local").setProperty("/PKDCUD", false);
			this.byId("PkgDels").setTitle("Edit Package Details");
			this._getUoM();
			this._oEditPackageDetails.open();
		},

		_getUoM: function () {
			this.getModel().read("/xSERPERPxFRP_UOM", {
				success: function (oData) {
					var sApp = this.getModel("local").getProperty("/PKDCUD");
					if (sApp) {
						this._oAddPackageDetails.getModel("local").setProperty("/ListUoM", oData.results);
					} else {
						this._oEditPackageDetails.getModel("local").setProperty("/ListUoM", oData.results);
					}
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
				}.bind(this)
			});
		},

		onDeletePress: function (oEvent) {
			var aData = this.getModel("local").getProperty("/PackageDetails");
			var SelectedItem = this.byId("packageDetails").getSelectedItem().getBindingContext("local").getObject();
			var aDelPkgDetails = [];
			this.getModel("local").getProperty("/PackageDetails").forEach(function (obj) {
				if (obj.packingMaterial !== SelectedItem.packingMaterial) {
					aDelPkgDetails.push(obj);
				}
			})
			var sTotalPieces = aDelPkgDetails.reduce(function (sum, item) {
				return sum + Number(item.pieceCount);
			}, 0);

			var sTotalPallets = aDelPkgDetails.reduce(function (sum, item) {
				return sum + Number(item.palletCount);
			}, 0);

			var sTotalWeight = aDelPkgDetails.reduce(function (sum, item) {
				return sum + Number(item.weight);
			}, 0);

			var oTotal = {
				totalPieces: sTotalPieces,
				totalPallets: sTotalPallets,
				totalWeight: sTotalWeight
			};

			this.getModel("local").setProperty("/total", oTotal);
			this.getModel("local").setProperty("/PackageDetails", aDelPkgDetails);
			// check enable button
			if (aDelPkgDetails.length > 0) {
				this.getModel("local").setProperty("/EnabledButton", true);
			} else {
				this.getModel("local").setProperty("/EnabledButton", false);
			}
		},

		onSelectionChange: function (oEvent) {
			this.getModel("local").setProperty("/EnabledButton", true);
		},

		onClosePress: function () {
			var sApp = this.getModel("local").getProperty("/PKDCUD");
			if (sApp) {
				this._oAddPackageDetails.close();
			} else {
				this._oEditPackageDetails.close();
			}
		},

		onUpdatePress: function (oEvent) {
			var sApp = this.getModel("local").getProperty("/PKDCUD");
			var aPackageDetails = this.getModel("local").getProperty("/PackageDetails");
			var aPakgeDels = [];
			var oValue;
			if (sApp) {
				oValue = this._oAddPackageDetails.getModel("local").getData();
			} else {
				oValue = this._oEditPackageDetails.getModel("local").getData();
			}
			delete oValue.ListUoM
			var bRequired = this._checkRequired(oValue);
			if (bRequired && sApp) {
				aPackageDetails.push(oValue);
				var sTotalPieces = aPackageDetails.reduce(function (sum, item) {
					return sum + Number(item.pieceCount);
				}, 0);

				var sTotalPallets = aPackageDetails.reduce(function (sum, item) {
					return sum + Number(item.palletCount);
				}, 0);

				var sTotalWeight = aPackageDetails.reduce(function (sum, item) {
					return sum + Number(item.weight);
				}, 0);

				var oTotal = {
					totalPieces: sTotalPieces,
					totalPallets: sTotalPallets,
					totalWeight: sTotalWeight
				};

				this.getModel("local").setProperty("/total", oTotal);

				this.getModel("local").setProperty("/PackageDetails", aPackageDetails);
				// if (aPackageDetails.length > 0) {
				// 	this.getModel("local").setProperty("/EnabledButton", true);
				// } else {
				// 	this.getModel("local").setProperty("/EnabledButton", false);
				// }
				this._oAddPackageDetails.close();
			} else {
				if (bRequired) {
					aPackageDetails.forEach(function (obj) {
						if (obj.packingMaterial === oValue.packingMaterial) {
							Object.assign(obj, oValue);
						}
						aPakgeDels.push(obj);
					});
					var sTotalPieces = aPackageDetails.reduce(function (sum, item) {
						return sum + item.pieceCount;
					}, 0);

					var sTotalPallets = aPackageDetails.reduce(function (sum, item) {
						return sum + item.palletCount;
					}, 0);

					var sTotalWeight = aPackageDetails.reduce(function (sum, item) {
						return sum + item.weight;
					}, 0);

					var oTotal = {
						totalPieces: sTotalPieces,
						totalPallets: sTotalPallets,
						totalWeight: sTotalWeight
					};
					this.getModel("local").setProperty("/total", oTotal);
					this.getModel("local").setProperty("/PackageDetails", aPakgeDels);
					this._oEditPackageDetails.close();
				}
			}
		},

		_checkRequired: function (Value) {
			var fieldIds = {
				packingMaterial: "idPackingMaterial",
				palletCount: "idPalletCount",
				pieceCount: "idPieceCount",
				weight: "idWeight",
				weightUoM: "idWeightUoM",
				huNumber: "idHUnit",
				length: "idLength",
				width: "idWidth",
				height: "idHeight",
				dimensionsUoM: "idDimensionsUoM"
			};
			var hasError = false;
			for (var key in Value) {
				if (Value.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (Value[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}
			return !hasError;
		},

		onUpdateTable: function (oEvent) {
			var sSeleleted = oEvent.getSource().getSelectedItems();
			if (sSeleleted.length > 0) {
				this.getModel("local").setProperty("/EnabledButton", true);
			} else {
				this.getModel("local").setProperty("/EnabledButton", false);
			}
		},

		onInputLiveChange: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			if (sValue === "") {
				oEvent.getSource().setValue(0);
			}
		},

		_generateMessages: function (aParamMessages) {
			var aMessages = [];
			for (var i = 0; i < aParamMessages.length; i++) {
				var oMessage = this._generateMessageObject(aParamMessages[i]);
				if (oMessage) {
					aMessages.push(oMessage);
				}
			}
			return aMessages;
		},

		_generateMessageObject: function (oPassMessage) {
			var oMessage = {
				type: "Warning",
				title: oPassMessage.Message,
				description: ""
			};
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = library.Error;
				break;
			case "W":
				oMessage.type = library.Warning;
				break;
			case "I":
				oMessage.type = library.Information;
				break;
			case "S":
				oMessage.type = library.Success;
				break;
			default:
				oMessage.type = library.Warning;
				break;
			}
			return oMessage;
		},

		onCancel: function () {
			this._consolidationDialog.close();
		},
		/***********************  Enhancment to WOS  ***************************/
		onAcceptShipmentPress: function () {
			var aSelected = sap.ui.getCore().byId("idDeliveries").getSelectedItems();
			if (aSelected.length > 0) {
				var aSelectedData = [];
				for (var i = 0; i < aSelected.length; i++) {
					var oData = aSelected[i].getBindingContext("local").getObject();
					aSelectedData.push(oData);
				}
				this.showBusy();
				var oRequestPayload = this.generateAcceptShipmentPayload(aSelectedData);
				this.getModel().create("/RequestForPickupQuerySet", oRequestPayload, {
					success: function (oData) {
						this.getModel("local").setProperty("/basic", oData.basic);
						this.getModel("local").setProperty("/total", oData.totals);
						this.getModel("local").setProperty("/PackageDetails", oData.packageDetails.results);
						if (oData.carrierMoreOption.results.length > 0) {
							this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.carrierMoreOption.results);
							this._displayShipmentCarrierMoreOptTab();
						}
						if (oData.return && oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.oDeliveriesDialog.close();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				MessageBox.warning(this.oBundle.getText("MessageInfor"));
			}
		},

		generateAcceptShipmentPayload: function (aSelectedData) {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			var oPayload = {
				inputIDs: this.byId("txtId").getValue(),
				inputType: this.sInputType,
				basic: this.getModel("local").getProperty("/basic"),
				documentNumber: "",
				multiDeliveries: {
					showMultiDeliv: false,
					deliveries: (aSelectedData) ? aSelectedData : []
				},
				carrierMoreOption: [{
					valueList: []
				}],
				packageDetails: [],
				action: "Multideliv",
				return: []
			};
			return oPayload;
		},

		onSearchDelivery: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			var oAllFilter = new Filter([
				new Filter("Delivery", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			sap.ui.getCore().byId("idDeliveries").getBinding("items").filter([oAllFilter]);
		},

		onCancelPopup: function () {
			this.oDeliveriesDialog.close();
			var oTableList = sap.ui.getCore().byId("idDeliveries").getSelectedItems();
			if (oTableList.length > 0) {
				MessageBox.warning(this.oBundle.getText("MessCancelInfor"));
			} else {
				MessageBox.warning(this.oBundle.getText("MessageInfor"));
			}
		}
	});
});