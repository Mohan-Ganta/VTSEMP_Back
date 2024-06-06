const router = require('express').Router()
const user = require('../models/user.model')

router.route("/add").post((req,res)=>{
        const fullname = req.body.fullname
        const phoneNo = req.body.phoneNo
        const email = req.body.email
        const empId = req.body.empId
        const profileUrl = req.body.profileUrl
        const docUrl = req.body.docUrl
        const password = req.body.password

        const newUser = new user({ fullname ,phoneNo,email,empId,profileUrl,docUrl,password})
        newUser.save()
        .then(()=>res.status(200).json("user added successfully"))
        .catch((err)=>res.status(400).json("error"+err))
})
router.route('/').get((req,res)=>{
    user.find()
    .then(data=>res.json(data))
    .catch(err=>res.json("error"+err))
})
router.route('/login/:email').get((req,res)=>{
    user.findOne({email:req.params.email})
    .then((data)=>res.status(200).json(data))
})

module.exports = router