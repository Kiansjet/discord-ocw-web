// Modules
const {app,BrowserWindow,ipcMain,shell} = require('electron')
const discord = require('discord.js')
const url = require('url')
const fileSystem = require('fs')
const https = require('https')

try {
	require('./Assets/testingActivation.js')
} catch {
	process.exit(5)
}

const useDiscordJs = false // true to use discord.js module, otherwise standard http posts to discord api
// NOTE I never got the pfp changer to work with discord.js, which is why I switched to vanilla web calls.
const baseDiscordApiUrl = 'http://discordapp.com/api/v6' // gonna have to update this every now and then

let window
let cachedWebhookDisplayName

app.on('ready',function() {
	// Window Setup
	window = new BrowserWindow({
		title: 'Kian\'s One-click-webhook',
		icon: 'Assets/Icon.png',
		width: 450,
		height: 620,
		minWidth: 316,
		minHeight: 300,
		//resizable: false,
		backgroundColor: '#2c2f33',
		show: false,
		webPreferences: {
			devTools: true,
			nodeIntegration: true, // default val is changing so I cemented it
		},
	})
	window.once('ready-to-show',function() {
		window.show()
	})
	window.loadFile('Assets/webMain.html')
	window.setMenu(null)
	window.on('close',function(event) {
		event.preventDefault()
		
		ipcMain.once('saveFormData',function() {
			window.destroy()
		})
		window.webContents.send('requestFormData')
	})

	// Handle ipc calls
	ipcMain.on('sendButtonClicked',async function(event,/*webhookId,webhookToken,*/webhookUrl,webhookName,webhookProfilePic,message) {
		window.setProgressBar(2) // any val outside of 0-1 is intermediate mode
		let parsedUrl = url.parse(webhookUrl)
		if (parsedUrl.hostname != 'discordapp.com') {
			event.sender.send('sendingComplete',false,'Webhook url hostname is not discordapp.com')
			window.setProgressBar(-1)
			return
		}
		parsedUrl = parsedUrl.pathname.split('/')
		if (parsedUrl[1] != 'api' || parsedUrl[2] != 'webhooks') {
			event.sender.send('sendingComplete',false,'Invalid webhook url pathname component')
			window.setProgressBar(-1)
			return
		}
		if (message.replace(/\s/g,'') == '') {
			event.sender.send('sendingComplete',false,'Empty message field')
			window.setProgressBar(-1)
			return
		}
		if (message.length > 2000) {
			event.sender.send('sendingComplete',false,'Message length > 2000. Length is ' + message.length)
			window.setProgressBar(-1)
			return
		}
		const webhookId = parsedUrl[3]
		const webhookToken = parsedUrl[4]
		if (useDiscordJs) {
			let webhook = new discord.WebhookClient(webhookId,webhookToken)
			webhook.name = webhookName
			webhook.avatar = webhookProfilePic
			
			if (cachedWebhookDisplayName != webhookName) {
				await webhook.edit(webhookName,webhookProfilePic).then(function() {
					cachedWebhookDisplayName = webhookName
				}).catch(function(err) {
					event.sender.send('errorToConsole','Webhook edit failed. Error:')
					event.sender.send('errorToConsole',err)
				})
			}

			webhook.send(message).then(function() {
				//ipcMain.send('sendingComplete',true) // doesnt work the same way in reverse, instead use the func below
				event.sender.send('sendingComplete',true)
			}).catch(function(err) {
				//ipcMain.send('sendingComplete',false,err) // doesnt work the same way in reverse, instead use the func below
				event.sender.send('sendingComplete',false,err)
			})
		} else {
			const requestBody = {
				content: message,
				username: webhookName,
				avatar_url: webhookProfilePic
			}
			const request = https.request(`${baseDiscordApiUrl}/webhooks/${webhookId}/${webhookToken}`,{
				method: 'POST',
				protocol: 'https:',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			request.on('response',function(response) {
				if (response.statusCode >= 200 && response.statusCode <= 299) {
					event.sender.send('sendingComplete',true)
				} else {
					event.sender.send('sendingComplete',false,`${response.statusCode} ${response.statusMessage}`)
				}
				
			})

			request.write(JSON.stringify(requestBody))
			request.end()
		}
		window.setProgressBar(-1)
	})
	ipcMain.on('openDevTools',function() {
		window.openDevTools()
	})
	ipcMain.on('openGitHubRepo',function(event) {
		fileSystem.access('package.json',fileSystem.constants.F_OK | fileSystem.constants.R_OK,function(err) {
			if (err) {
				event.sender.send('errorToConsole','Read access to package.json denied. File may not exist. Error:\n' + err)
			} else {
				fileSystem.readFile('package.json','utf8',function(err,data) {
					if (err) {
						event.sender.send('errorToConsole','Failed to read package.json. Error:\n' + err)
					} else {
						try {
							let gitRepo = JSON.parse(data).repository.url
							shell.openExternal(gitRepo)
						} catch(err) {
							event.sender.send('errorToConsole','Failed to parse package.json for repository.url. File may have been modified. Error:\n' + err)
						}
					}
				})
			}
		})
	})
	ipcMain.on('loadPackage.json',function(event) {
		fileSystem.access('package.json',fileSystem.constants.F_OK | fileSystem.constants.R_OK,function(err) {
			if (err) {
				event.sender.send('errorToConsole','Read access to package.json denied. File may not exist. Error:\n' + err)
			} else {
				fileSystem.readFile('package.json','utf8',function(err,data) {
					if (err) {
						event.sender.send('errorToConsole','Failed to read package.json. Error:\n' + err)
					} else {
						try {
							data = JSON.parse(data)
							event.sender.send('package.jsonLoaded',data)
						} catch(err) {
							event.sender.send('errorToConsole','Failed to parse package.json for repository.url. File may have been modified. Error:\n' + err)
						}
					}
				})
			}
		})
	})
	ipcMain.on('loadFormData',function(event) {
		fileSystem.access('Cache/formData',fileSystem.constants.F_OK | fileSystem.constants.R_OK,function(err) {
			if (!err) {
				fileSystem.readFile('Cache/formData','utf8',function(err,data) {
					if (!err) {
						event.sender.send('formDataLoaded',JSON.parse(data))
					}
				})
			}
		})
	})
	ipcMain.on('saveFormData',function(event,data) {
		data = JSON.stringify(data)

		fileSystem.access('Cache',fileSystem.constants.F_OK,function(err) {
			if (err) {
				fileSystem.mkdir('Cache',function() {})
			}
			fileSystem.writeFile('Cache/formData',data,'utf8',function () {})
		})
	})

	ipcMain.on('crashApp',function() {
		app.exit(0)
	})
})
