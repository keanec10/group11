var app = new Vue({
	
	el: "#app",
	
	data: {
		
		pages: [
			
			{ key: "results", title: "RESULTS" },
			{ key: "camera", title: "CAMERA" },
			{ key: "info", title: "INFO" }
			
		],
		
		currentPage: null,
		nxtPage: null,
		
		logs: null,
		
		activeTestCategory: "",
		
		cameraStage: "prep"
		
	},
	
	methods: {
		
		navigate: (pageKey) => {
			
			if (pageKey === app.$data.currentPage) return;
			
			app.$data.nxtPage = pageKey;
			document.getElementById("main").style.opacity = "0";
			
			setTimeout(() => {
				
				app.$data.currentPage = pageKey;
				document.getElementById("main").style.opacity = "1";
				
			}, 250);
			
		},
		
		addTestCategory: () => {
			
			const numTestCategories = app.$data.logs.index.length;
			let nxtTestCategoryID = 0;
			if (numTestCategories > 0) nxtTestCategoryID = (app.$data.logs.index[numTestCategories - 1].id + 1);
			
			const newTestCategoryName = prompt("New test category name:");
			if (newTestCategoryName === null) return;
			
			const newTestCategory = {
				name: newTestCategoryName.trim(),
				id: nxtTestCategoryID
			};
			
			if (newTestCategory.name === "") return;
			if (app.$data.logs.index.findIndex((item) => (item.name === newTestCategory.name)) !== -1) {
				alert("A test category already exists with this name, please choose another name");
				return;
			}
			
			app.$data.logs.index.push(newTestCategory);
			
			updateLogs();
			
			app.$data.activeTestCategory = newTestCategory.id;
			
		},
		
		removeTestCategory: () => {
			
			const targetTestCategory = app.$data.activeTestCategory;
			
			const targetIndex = app.$data.logs.index.findIndex((item) => (item.id === targetTestCategory));
			
			if (targetIndex === -1) return;
			
			const userOK = confirm("Removing '" + app.$data.logs.index[targetIndex].name + "' will remove all associated test results- is this ok?");
			
			if (userOK === false) return;
			
			app.$data.logs.index.splice(targetIndex, 1);
			app.$data.logs.tests = app.$data.logs.tests.filter(item => item.indexID !== targetTestCategory);
			
			updateLogs();
			
			app.$data.activeTestCategory = "";
			
		},
		
		beginCameraCapture: () => app.$data.cameraStage = "capture",
		
		addTest: () => {
			
			const numTests = app.$data.logs.tests.length;
			let nxtTestID = 0;
			if (numTests > 0) nxtTestID = (app.$data.logs.tests[numTests - 1].id + 1);
			
			const newTest = {
				id: nxtTestID,
				indexID: app.$data.activeTestCategory,
				count: nxtTestID,
				timestamp: new Date().toString()
			};
			
			app.$data.logs.tests.push(newTest);
			
			updateLogs();
			
			app.$data.cameraStage = "prep";
			
		}
		
	}
	
});


const updateLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile("logs.json", { create: false }, (fileEntry) => {
			
			fileEntry.createWriter((fileWriter) => fileWriter.write(new Blob([JSON.stringify(app.$data.logs)], { type: "text/plain" })));
			
		});
		
	});
	
};

const initLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile("logs.json", { create: true }, (fileEntry) => {
			
			fileEntry.createWriter((fileWriter) => {
				
				fileWriter.onwriteend = () => app.$data.logs = { index: [], tests: [] };
				
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
					
					reader.onloadend = () => app.$data.logs = JSON.parse(reader.result);
					
					reader.readAsText(file);
					
				});
				
			},
			
			// failure: logs need to be created
			() => initLogs()
			
		)
		
	});
	
}


const initApp = () => {
	
	loadLogs();
	
	app.navigate("results");
	
};

document.addEventListener("deviceready", initApp);

