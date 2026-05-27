sap.ui.define(["sap/ui/layout/form/SimpleForm",
	"com/erpis/shiperp/hr7/requestforpickup/common/ControlUtils",
	"com/erpis/shiperp/hr7/requestforpickup/common/Utils"
], function (SimpleForm, ControlUtils, Utils) {
	"use strict";
	return {
		/**Render dynamic fields for more option view package level
		 * */
		renderMoreOptionForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oDataOld = aSourceFields;
				var oMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, bDeep, false, oDataOld);
				oController.oMoreOptionDialog.addContent(oMoreOptionForm);
			}
		},
		/**
		 * render form for shipment level
		 **/
		renderShipmentCarrierOptionForm: function (aSourceFields, oController, bDeep) {
			var oDataOld = aSourceFields;
			if (aSourceFields.length > 0) {
				var oShipmentMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, bDeep, true, oDataOld);
				oController.oShipmentCarrierOptionTab.addBlock(oShipmentMoreOptionForm);
			}
		},
		/**
		 * @param: bShipment - true is for shipment level; false for package level
		 * */
		renderMoreOptionFormContent: function (aOriginalSourceFields, oController, bDeep, bShipment, oDataOld) {
			oController.aTable = [];
			var aSourceFields = Utils._getExistItemsArray(aOriginalSourceFields, "fieldPName", "");
			this.bcheckTableMoreOption = false;
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				var oMoreOptionForm = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");
				var sFieldGroup = "";
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].fieldGroup !== sFieldGroup && aSourceFields[i].sequence === "01") {
						var oTitle = new sap.ui.core.Title({
							text: aSourceFields[i].groupText
						});
						oMoreOptionForm.addContent(oTitle);
						sFieldGroup = aSourceFields[i].FieldGroup;
					}
					if (aSourceFields[i].carrCode === "" || aSourceFields[i].fieldName === "") {
						continue;
					}
					var oLabel = ControlUtils.Label(aSourceFields[i].fieldDesc);
					if (aSourceFields[i].fieldType !== "08") {
						oMoreOptionForm.addContent(oLabel);
					}

					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.ComboboxValues = (aSourceFields[i].Value_List) ? aSourceFields[i].Value_List.results : []; //set data for combobox
					//Add event for checkbox if FieldValue2 not null
					if (aSourceFields[i].fieldType === "02" && aSourceFields[i].fieldValue !== "") {
						//add checkbox event to enable disable button
					}
					//Field type button event handler
					if (aSourceFields[i].fieldType === "08") {
						oSourceField.FnCallback = function (data) {
							var aDeepFields;
							var oMoreOptionChild;
							if (aOriginalSourceFields.length === oDataOld.length) {
								aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "fieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aDeepFields, oController, true, bShipment);
									thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							} else {
								aDeepFields = Utils._getExistItemsArray(oDataOld, "fieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aDeepFields, oController, true, bShipment);
									thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							}
						};
					}

					var oFieldBase = ControlUtils.BuildControlByType(oSourceField, oController);
					// Disable option before add to content
					if (aSourceFields[i].displayOption === "1" || aSourceFields[i].displayOption === "2") {
						if (aSourceFields[i].displayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						if (aSourceFields[i].fieldType === "10") {
							oFieldBase.setVisible(false);
						} else {
							oFieldBase.setEnabled(true);
						}
					} else {
						//Axo 6913
						oFieldBase.setEnabled(false);
					}
					//Axo 4770
					if (oController.isCanShip === false) {
						oFieldBase.setEnabled(false);
					}
					oFieldBase.setWidth("auto");
					oMoreOptionForm.addContent(oFieldBase);
				} //end loop
				return oMoreOptionForm; // return the VBox instead of the SimpleForm
			}
			return null;
		},

	};
});