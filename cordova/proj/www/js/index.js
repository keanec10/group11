//#region -> Vue

var app = new Vue({
	
	el: "#app",
	
	data: {
		
		// navigation
		pages: [
			{ key: "results", title: "RESULTS", img: "https://us02st1.zoom.us/static/94172/image/new/ZoomLogo.png" },
			{ key: "camera", title: "CAMERA", img: "https://vuejs.org/images/logo.png" },
			{ key: "info", title: "INFO", img: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" }
		],
		currentPage: null,
		nxtPage: null,
		
		// the test data
		logs: {
			index: [],
			tests: []
		},
		
		// test configuration
		activeTestCategory: "",
		cameraStage: "prep"
		
	},
	
	methods: {
		
		navigate: (pageKey) => {
			
			// don't trigger an update if the page wasn't changed
			if (pageKey === app.$data.currentPage) return;
			
			// preempt the page change with styling
			app.$data.nxtPage = pageKey;
			document.getElementById("main").style.opacity = "0";
			
			// wait for the styling to complete before displaying the new page
			setTimeout(() => {
				
				app.$data.currentPage = pageKey;
				document.getElementById("main").style.opacity = "1";
				
			}, 250);
			
		},
		
		addTestCategory: () => {
			
			// find the next available ID
			// since we are allowing users to remove test categories, a simple count won't suffice
			// adding the first test category is a special case where a normal array access would result in index [-1]
			const numTestCategories = app.$data.logs.index.length;
			let nxtTestCategoryID = 0;
			if (numTestCategories > 0) nxtTestCategoryID = (app.$data.logs.index[numTestCategories - 1].id + 1);
			
			
			// ask the user for the name of their new test category
			// if they left it blank, ignore it
			const newTestCategoryName = prompt("New test category name:");
			if (newTestCategoryName === null) return;
			
			
			// create the new object to be written to the data store
			// trim whitespace to avoid confusion when comparing names
			const newTestCategory = {
				name: newTestCategoryName.trim(),
				id: nxtTestCategoryID
			};
			
			// again, don't allow blank names
			if (newTestCategory.name === "") return;
			// also don't allow duplicate names
			if (app.$data.logs.index.findIndex((item) => (item.name === newTestCategory.name)) !== -1) {
				alert("A test category already exists with this name, please choose another name");
				return;
			}
			
			
			// append the new object to the dynamic data store
			app.$data.logs.index.push(newTestCategory);
			
			// write the updated data store to the file system
			updateLogs();
			
			
			// select the newly created test category in the drop down menu for nice user feedback
			app.$data.activeTestCategory = newTestCategory.id;
			
		},
		
		removeTestCategory: () => {
			
			// sanity check for the existence of the test category that is being removed
			const targetTestCategory = app.$data.activeTestCategory;
			const targetIndex = app.$data.logs.index.findIndex((item) => (item.id === targetTestCategory));
			if (targetIndex === -1) return;
			
			
			// confirm with the user that they would like to remove the test category
			// remind them that it will also delete all test results from that category
			const userOK = confirm("Removing '" + app.$data.logs.index[targetIndex].name + "' will remove all associated test results- is this ok?");
			if (userOK === false) return;
			
			
			// remove the test category and its corresponding results from the dynamic data store
			app.$data.logs.index.splice(targetIndex, 1);
			app.$data.logs.tests = app.$data.logs.tests.filter(item => item.indexID !== targetTestCategory);
			
			// write the updated data store to the file system
			updateLogs();
			
			
			// reset the drop down menu for nice user feedback
			app.$data.activeTestCategory = "";
			
		},
		
		// proceed from configuring the test category to performing the test
		beginCameraCapture: () => {
			
			// CAMERA FEED SCRIPTING GOES HERE!!!!!!
			
			app.$data.cameraStage = "capture";
			
		},
		
		addTest: () => {
			
			// find the next available ID
			// since we are allowing users to remove test categories, a simple count won't suffice
			// adding the first test category is a special case where a normal array access would result in index [-1]
			const numTests = app.$data.logs.tests.length;
			let nxtTestID = 0;
			if (numTests > 0) nxtTestID = (app.$data.logs.tests[numTests - 1].id + 1);
			
			
			// create the new object to be written to the data store
			// "count" will be sourced in future from plugging in the image processing 
			const newTest = {
				id: nxtTestID,
				indexID: app.$data.activeTestCategory,
				count: nxtTestID,
				timestamp: new Date().toString()
			};
			
			// append the new object to the dynamic data store
			app.$data.logs.tests.push(newTest);
			
			// write the updated data store to the file system
			updateLogs();
			
			
			// reset the camera screen to the configuration section to prepare for the next testing
			app.$data.cameraStage = "prep";
			
		}
		
	}
	
});

//#endregion -> Vue


//#region -> file system

const updateLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile("logs.json", { create: false }, (fileEntry) => {
			
			// overwrite the permanent data store with the updated dynamic data store
			fileEntry.createWriter((fileWriter) => fileWriter.write(new Blob([JSON.stringify(app.$data.logs)], { type: "text/plain" })));
			
		});
		
	});
	
};

// create the data store the first time the user opens the app
const initLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile("logs.json", { create: true }, (fileEntry) => {
			
			fileEntry.createWriter((fileWriter) => {
				
				// initialise the dynamic data store when the permanent data store is initialised
				fileWriter.onwriteend = () => app.$data.logs = { index: [], tests: [] };
				
				// initialise the permanent data store structure
				fileWriter.write(new Blob([JSON.stringify({ index: [], tests: [] })], { type: "text/plain" }));
				
			});
			
		});
			
	});
	
};

const loadLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile(
			
			"logs.json",
			{ create: false },
			
			// success: logs exist already
			(fileEntry) => {
				
				fileEntry.file((file) => {
					
					const reader = new FileReader();
					
					// load the permanent data store into the dynamic data store
					reader.onloadend = () => app.$data.logs = JSON.parse(reader.result);
					
					reader.readAsText(file);
					
				});
				
			},
			
			// failure: logs need to be created
			() => initLogs()
			
		)
		
	});
	
}

//#endregion -> file system


//#region -> init

const initApp = () => {
	
	loadLogs();
	
	app.navigate("results");
	
};

document.addEventListener("deviceready", initApp);

//#endregion -> init
