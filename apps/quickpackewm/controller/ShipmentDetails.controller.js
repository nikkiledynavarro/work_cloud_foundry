sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/quickpackewm/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/Token",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/quickpackewm/model/formatter",
	"com/erpis/shiperp/hr7/quickpackewm/common/Utils",
	"com/erpis/shiperp/hr7/quickpackewm/common/ControlUtils",
	"com/erpis/shiperp/hr7/quickpackewm/common/DynamicView",
], function (library, BaseController, JSONModel, MessageToast, Token, Fragment, Filter, FilterOperator, MessageBox, formatter,
	Utils, ControlUtils, DynamicView) {
	"use strict";
	var MessageType = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.quickpackewm.controller.ShipmentDetails", {

		/**
		 * @override
		 **/
		oBundle: null,
		formatter: formatter,

		onInit: function () {
			this.oBundle = this.getResourceBundle();
			this.setModel(new JSONModel({}), "local");
			// Initialize Message Model
			var oMessageModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oMessageModel, "messageModel");
			this.getRouter().getRoute("shipmentdetails").attachPatternMatched(this._onObjectMatched, this);
		},

		_onObjectMatched: function (oEvent) {
			// refresh data
			this.getModel("local").setData({});
			// get parameter
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			this.sWarehouseNumber = oEvent.getParameter("arguments").WarehouseNumber;
			this.sInputType = oEvent.getParameter("arguments").InputType;
			this.sInputIDs = oEvent.getParameter("arguments").InputID;
			// Hide Object Page Section
			this.byId("iconTabInternational").setVisible(false);
			this.byId("iconTabCarrier").setVisible(false);
			this.byId("iconHTS").setVisible(false);
			// Assign Table control
			this.oContentTable = this.byId("tableTotes");
			this.oHUTable = this.byId("tableHU");
			// Get Shipment Details
			this._getShipmentDetails();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		_getShipmentDetails: function () {
			var oRequestData = this._generateShipmentDetailsUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
					this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					this._displayRenderFormTab(oData.shipmentDetails);
					if (oData.shipmentDetails.hts.results.length > 0) {
						this.getModel("local").setProperty("/HTS", oData.shipmentDetails.hts.results);
					}
					if (oData.handlingUnits.results.length > 0) {
						var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
							return sum + Number(item.weight);
						}, 0).toString();

						this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
					}

					// check display tab
					this._displayTabs();
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					MessageBox.error(this.oBundle.getText(oError.message));
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateShipmentDetailsUsecase: function () {
			var aHUs = this.getOwnerComponent().getModel("local").getProperty("/HUs");
			var aContent = this.getOwnerComponent().getModel("local").getProperty("/Contents");
			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: (aContent) ? aContent : [],
				action: "GetShipmentDetails",
				handlingUnits: (aHUs) ? aHUs : [],
				shipmentDetails: {
					basic: {},
					hts: [],
					internationalMoreOptions: [{
						valueList: []
					}],
					carrierMoreOptions: [{
						valueList: []
					}]
				},
			};
			return oData;
		},

		_displayRenderFormTab: function (oValue) {
			// Tab Carrier 
			if (oValue.carrierMoreOptions.results.length > 0) {
				this.getModel("local").setProperty("/ShipmentCarrierOptions", oValue.carrierMoreOptions.results);
				this.byId("iconTabCarrier").setVisible(true);
				this.byId("iconTabCarrierSub").setTitle(this.getModel("local").getProperty("/basic/general/Carrier"));
				this._generateRenderFormOptions(oValue.carrierMoreOptions.results, this.byId("iconTabCarrierSub"));
			} else {
				this.byId("iconTabCarrier").setVisible(false);
			}

			// Tab International 
			if (oValue.internationalMoreOptions.results.length > 0) {
				this.getModel("local").setProperty("/ShipmentInternationalOptions", oValue.internationalMoreOptions.results);
				this.byId("iconTabInternational").setVisible(true);
				this.byId("iconTabInternationSub").setTitle("International");
				this._generateRenderFormOptions(oValue.internationalMoreOptions.results, this.byId("iconTabInternationSub"));
			} else {
				this.byId("iconTabInternational").setVisible(false);
			}

		},

		_generateRenderFormOptions: function (aValue, oContainer) {
			this.Control = oContainer
				//resset shipment
			if (this.Control.getBlocks()[0] instanceof sap.m.FlexBox) {
				if (this.Control.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
					this.Control.getBlocks()[0].getItems()[0].removeAllContent();
				} else {
					this.Control.getBlocks()[0].getItems()[1].removeAllItems()
				}
			} else {
				var oCurrForm = this.Control.getBlocks()[0];
				if (oCurrForm) {
					oCurrForm.removeAllContent();
				}
			}
			this.Control.removeAllBlocks();
			//add prefix before process
			var aFields = Utils._addPrefixToFieldName(aValue, "SHIPMENTX_");
			DynamicView.renderForm(aFields, this, false);
		},

		onSelectionChange: function (oEvent) {
			var oTable = oEvent.getSource();
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			if (oContext) {
				var oData = oContext.getObject();
				var sResultDims = oData.length + "x" + oData.width + "x" + oData.height;
				this.getModel("local").setProperty("/basic/general/Dims", sResultDims);
				this.getModel("local").setProperty("/basic/general/Weight", oData.weight);
				this.getModel("local").setProperty("/basic/general/Packagetype", oData.pMat);
				this.getModel("local").setProperty("/basic/general/Declaredvalue", oData.Declaredvalue);
				this.getModel("local").setProperty("/basic/general/Insuredvalue", oData.Insuredvalue);
				this.getModel("local").setProperty("/basic/general/Weightoption", "2");
				this.getModel("local").setProperty("/basic/general/Dimoption", "0");
			}

			var aIndices = oTable.getSelectedIndices();
			var aSelectedContexts = aIndices.map(function (iIndex) {
				return oTable.getContextByIndex(iIndex);
			});

			var aSelectedHu = aSelectedContexts.map(function (oContext) {
				return oContext.getObject().outbHu;
			});

			var aHandlingUnits = this.getModel("local").getProperty("/HUs") || [];
			aHandlingUnits.forEach(function (oTote) {
				oTote.sel = aSelectedHu.includes(oTote.outbHu) ? 'X' : '';
			});
			this.getModel("local").setProperty("/HUs", aHandlingUnits);
		},

		onNavigationsBackPress: function (oEvent) {
			this.getRouter().navTo("main", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},

		onMoreOptionClose: function () {
			this.oPackageLevelOptionsDialog.close();
		},

		_displayTabs: function () {
			//  Check Domestic 
			var bDomestic = this.getModel("local").getProperty("/basic/general/ShipmentFlags/Domesticflag");
			if (bDomestic) {
				this.byId("idTabSeparatorImporter").setVisible(false);
				this.byId("idTabImporterFilter").setVisible(false);
			} else {
				this.getModel("local").setProperty("/basic/general/Declaredvalue", "0.000");
				this.byId("idTabSeparatorImporter").setVisible(true);
				this.byId("idTabImporterFilter").setVisible(true);
			}
		},
		onEditDimensions: function () {
			var oEdit = {
				length: "",
				width: "",
				height: ""
			};
			this.getModel("local").setProperty("/EditDimensions", oEdit);
			this.oEditDimensionsDialog = Utils.getFragment("", "general.EditDimensionsDialog", this);
			this.oEditDimensionsDialog.open();
		},

		onCloseEdit: function () {
			this.oEditDimensionsDialog.close();
		},

		onConfirmEditDimensions: function () {
			var oData = this.getModel("local").getProperty("/EditDimensions");
			var aHUs = this.getModel("local").getProperty("/HUs");
			var bHasEmpty = false;
			var aFields = ["length", "width", "height"];
			aFields.forEach(function (sField) {
				var oControl = this.byId(sField);
				if (!oData[sField]) {
					oControl.setValueState("Error");
					bHasEmpty = true;
				} else {
					oControl.setValueState("None");
				}
			}.bind(this));
			var sDimension = "";
			if (!bHasEmpty) {
				this.showBusy();
				sDimension = oData.length + "x" + oData.width + "x" + oData.height;
				aHUs.forEach(function (hu) {
					if (hu.trackingnumber) return;
					aFields.forEach(function (key) {
						if (oData.hasOwnProperty(key) && oData[key] != null && oData[key] !== "") {
							hu[key] = oData[key];
						}
					});
				});
				this.getModel("local").setProperty("/HUs", aHUs);
				this.getModel("local").setProperty("/basic/general/Dims", sDimension);
				this.oEditDimensionsDialog.close();
				this.getModel().create("/QuickPackQuerySet", this._generateDimensionsUsecase(), {
					success: function (oData) {
						this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
						if (oData.handlingUnits.results.length > 0) {
							var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
								return sum + Number(item.weight);
							}, 0).toString();
							this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
						}
						if (oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						MessageBox.error(this.oBundle.getText(oError.message));
						this.hideBusy();
					}.bind(this)
				});
			} else {
				this.getModel("local").setProperty("/basic/general/Dims", sDimension);
			}
		},

		_generateDimensionsUsecase: function () {
			var aHUs = this.getModel("local").getProperty("/HUs");
			var oBasic = this.getModel("local").getProperty("/basic");
			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: "UpdateDimensions",
				handlingUnits: (aHUs) ? aHUs : [],
				shipmentDetails: {
					basic: oBasic
				}
			};
			return oData;
		},

		onUpdatePackageTypeAllHU: function () {
			var oTable = this.byId("handlingunits");
			var aIndices = oTable.getSelectedIndices();
			var oModel = this.getModel("local");
			var sPackagetype = oModel.getProperty("/basic/general/Packagetype");
			aIndices.forEach(function (iIndex) {
				var sPath = oTable.getContextByIndex(iIndex).getPath();
				oModel.setProperty(sPath + "/pMat", sPackagetype);
			});
			var oRequestData = this._generatePackageTypeUsecase("UpdateAllPackageType");
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
					this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					if (oData.handlingUnits.results.length > 0) {
						var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
							return sum + Number(item.weight);
						}, 0).toString();
						this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					MessageBox.error(this.oBundle.getText(oError.message));
					this.hideBusy();
				}.bind(this)
			});
		},

		onChangePackageType: function (oEvent) {
			var sValue = oEvent.getSource().getSelectedKey();
			this.getModel("local").setProperty("/basic/general/Packagetype", sValue);
			var oRequestData = this._generatePackageTypeUsecase("UpdatePackageType");
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
					this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					if (oData.handlingUnits.results.length > 0) {
						var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
							return sum + Number(item.weight);
						}, 0).toString();
						this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					MessageBox.error(this.oBundle.getText(oError.message));
					this.hideBusy();
				}.bind(this)
			});
		},
		_generatePackageTypeUsecase: function (sAction) {
			var aHUs = this.getModel("local").getProperty("/HUs") || [];
			var oBasic = this.getModel("local").getProperty("/basic");
			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: sAction,
				handlingUnits: (aHUs) ? aHUs : [],
				shipmentDetails: {
					basic: oBasic
				}
			};
			return oData;
		},

		onUpdateWeightAllHU: function () {
			var oRequestData = this._generateWeightAllHUUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
					this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					if (oData.handlingUnits.results.length > 0) {
						var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
							return sum + Number(item.weight);
						}, 0).toString();
						this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					MessageBox.error(this.oBundle.getText(oError.message));
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateWeightAllHUUsecase: function () {
			var oTable = this.byId("handlingunits");
			var aIndices = oTable.getSelectedIndices();
			var oModel = this.getModel("local");
			var sWeight = oModel.getProperty("/basic/general/Weight");
			var aHUs = oModel.getProperty("/HUs") || [];
			var aUpdateHus = JSON.parse(JSON.stringify(aHUs));
			aIndices.forEach(function (iIndex) {
				// var sPath = oTable.getContextByIndex(iIndex).getPath();
				// oModel.setProperty(sPath + "/weight", sWeight);
				aUpdateHus[iIndex].weight = sWeight;
			});

			var oBasic = this.getModel("local").getProperty("/basic");
			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: "UpdateAllHu",
				handlingUnits: (aUpdateHus) ? aUpdateHus : [],
				shipmentDetails: {
					basic: oBasic
				}
			};
			return oData;
		},

		onSubmitWeight: function () {
			var oRequestData = this._generateWeightUsecase();
			this.showBusy();
			this.getModel().create("/QuickPackQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
					this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
					if (oData.handlingUnits.results.length > 0) {
						var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
							return sum + Number(item.weight);
						}, 0).toString();
						this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
					}
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					MessageBox.error(this.oBundle.getText(oError.message));
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateWeightUsecase: function () {
			var aHUs = this.getModel("local").getProperty("/HUs");
			var oBasic = this.getModel("local").getProperty("/basic");
			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: "UpdateWeight",
				handlingUnits: (aHUs) ? aHUs : [],
				shipmentDetails: {
					basic: oBasic
				}
			};
			return oData;
		},

		onSelectionWeightOntion: function (oEvent) {
			var sValue = oEvent.getSource().getSelectedKey();
			this.getModel("local").setProperty("/basic/general/Weightoption", sValue);
			// Via Manual Entry
			if (sValue !== "3") {
				var oRequestData = this._generateSelectionOptionUsecase("UpdateWeight");
				this.showBusy();
				this.getModel().create("/QuickPackQuerySet", oRequestData, {
					success: function (oData) {
						this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
						if (oData.handlingUnits.results.length > 0) {
							var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
								return sum + Number(item.weight);
							}, 0).toString();
							this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
						}
						if (oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						MessageBox.error(this.oBundle.getText(oError.message));
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		onSelectionDimensionOntion: function (oEvent) {
			var sValue = oEvent.getSource().getSelectedKey();
			this.getModel("local").setProperty("/basic/general/Dimoption", sValue);
			// Via Manual Entry
			if (sValue !== "1") {
				var oRequestData = this._generateSelectionOptionUsecase("UpdateDimension");
				this.showBusy();
				this.getModel().create("/QuickPackQuerySet", oRequestData, {
					success: function (oData) {
						this.getModel("local").setProperty("/basic", oData.shipmentDetails.basic);
						this.getModel("local").setProperty("/HUs", oData.handlingUnits.results);
						if (oData.handlingUnits.results.length > 0) {
							var sTotalWeight = oData.handlingUnits.results.reduce(function (sum, item) {
								return sum + Number(item.weight);
							}, 0).toString();
							this.getModel("local").setProperty("/basic/general/Totalweight", sTotalWeight);
						}
						if (oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						MessageBox.error(this.oBundle.getText(oError.message));
						this.hideBusy();
					}.bind(this)
				});
			}

		},

		_generateSelectionOptionUsecase: function (sAction) {
			var aHUs = this.getModel("local").getProperty("/HUs");
			var oBasic = this.getModel("local").getProperty("/basic");
			var oData = {
				lgNum: this.sWarehouseNumber,
				shipStation: this.sStation,
				profile: this.sProfile,
				inputType: this.sInputType,
				inputID: this.sInputIDs,
				return: [],
				totes: [],
				action: sAction,
				handlingUnits: (aHUs) ? aHUs : [],
				shipmentDetails: {
					basic: oBasic
				}
			};
			return oData;
		},

	});
});