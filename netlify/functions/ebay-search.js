
exports.handler = async function(event){
 const q = event.queryStringParameters.q || "camping tent";
 return {
  statusCode:200,
  body:JSON.stringify({
   items:[
    {title:q+" example 1",price:120,image:"https://images.unsplash.com/photo-1504280390368-3972c3b6e1b4",url:"https://ebay.com"},
    {title:q+" example 2",price:140,image:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",url:"https://ebay.com"}
   ]
  })
 }
}
