sap.ui.define([
	"sap/ui/core/MessageType"
], function (MessageType) {
	"use strict";
	return {
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
				description: "",
				counter: 0
			};
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = MessageType.Error;
				break;
			case "W":
				oMessage.type = MessageType.Warning;
				break;
			case "I":
				oMessage.type = MessageType.Information;
				break;
			case "S":
				oMessage.type = MessageType.Success;
				break;
			default:
				oMessage.type = MessageType.Warning;
				break;
			}
			return oMessage;
		},
		_addMessage: function (aMsg, oController) {
			var aMessages = oController.getModel("messageModel").getProperty("/aMessages");
			var aNewMessages = aMsg.concat(aMessages);
			oController.getModel("messageModel").setProperty("/messagesLength", aNewMessages.length);
			oController.getModel("messageModel").setProperty("/aMessages", aNewMessages);
		}
	};
});